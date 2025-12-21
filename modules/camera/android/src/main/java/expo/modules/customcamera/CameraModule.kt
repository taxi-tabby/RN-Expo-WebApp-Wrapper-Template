package expo.modules.customcamera

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.util.Size
import android.view.Surface
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.LifecycleOwner
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class CameraModule : Module() {
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null
    private var imageAnalyzer: ImageAnalysis? = null
    private var isStreaming = false
    private var lastFrameTime = 0L
    private val TARGET_FPS = 10.0
    private val FRAME_INTERVAL_MS = (1000.0 / TARGET_FPS).toLong()
    
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
    private val cameraExecutor by lazy { Executors.newSingleThreadExecutor() }
    
    private var currentFacing: String = "back"
    
    companion object {
        private const val CAMERA_PERMISSION_REQUEST_CODE = 1001
    }

    override fun definition() = ModuleDefinition {
        Name("CustomCamera")
        Events("onCameraFrame", "onRecordingFinished", "onRecordingError")

        OnCreate {
            Log.d("CameraModule", "Camera module created")
            setupCrashHandler()
        }

        OnDestroy {
            try {
                Log.d("CameraModule", "OnDestroy called")
                cleanupCamera()
            } catch (e: Exception) {
                Log.e("CameraModule", "Destroy error", e)
            }
        }
        
        // 안전한 카메라 정리
        Function("cleanupCamera") {
            cleanupCamera()
        }

        // 권한 확인
        AsyncFunction("checkCameraPermission") { promise: Promise ->
            try {
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve(mapOf("granted" to false, "status" to "unavailable"))
                    return@AsyncFunction
                }
                
                val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                
                promise.resolve(mapOf(
                    "granted" to (cameraGranted && micGranted),
                    "cameraGranted" to cameraGranted,
                    "micGranted" to micGranted,
                    "status" to if (cameraGranted && micGranted) "granted" else "denied"
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "checkCameraPermission error", e)
                promise.resolve(mapOf("granted" to false, "status" to "error"))
            }
        }
        
        // 권한 요청 (Expo Permissions 사용)
        AsyncFunction("requestCameraPermission") { promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.resolve(mapOf("granted" to false, "status" to "unavailable"))
                    return@AsyncFunction
                }
                
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve(mapOf("granted" to false, "status" to "unavailable"))
                    return@AsyncFunction
                }
                
                // 이미 권한이 있는지 확인
                val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                
                if (cameraGranted && micGranted) {
                    promise.resolve(mapOf(
                        "granted" to true,
                        "cameraGranted" to true,
                        "micGranted" to true,
                        "status" to "granted"
                    ))
                    return@AsyncFunction
                }
                
                // 권한 요청
                val permissions = mutableListOf<String>()
                if (!cameraGranted) permissions.add(Manifest.permission.CAMERA)
                if (!micGranted) permissions.add(Manifest.permission.RECORD_AUDIO)
                
                activity.requestPermissions(permissions.toTypedArray(), CAMERA_PERMISSION_REQUEST_CODE)
                
                // 결과는 즉시 반환 (실제 권한 상태는 다시 checkCameraPermission으로 확인해야 함)
                promise.resolve(mapOf(
                    "granted" to false,
                    "cameraGranted" to cameraGranted,
                    "micGranted" to micGranted,
                    "status" to "requesting"
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "requestCameraPermission error", e)
                promise.resolve(mapOf("granted" to false, "status" to "error"))
            }
        }

        // 사진 촬영
        AsyncFunction("takePhoto") { promise: Promise ->
            try {
                if (imageCapture == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Camera not initialized"))
                    return@AsyncFunction
                }

                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }

                val photoFile = File.createTempFile("photo_", ".jpg", context.cacheDir)
                val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                imageCapture?.takePicture(
                    outputOptions,
                    cameraExecutor,
                    object : ImageCapture.OnImageSavedCallback {
                        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                            promise.resolve(mapOf("success" to true, "path" to photoFile.absolutePath))
                        }
                        override fun onError(exception: ImageCaptureException) {
                            promise.resolve(mapOf("success" to false, "error" to exception.message))
                        }
                    }
                )
            } catch (e: Exception) {
                Log.e("CameraModule", "takePhoto error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 카메라 시작
        AsyncFunction("startCamera") { facing: String, promise: Promise ->
            saveDebugLog("=== startCamera START ===")
            saveDebugLog("Parameters - facing: $facing")
            Log.d("CameraModule", "=== startCamera START ===")
            Log.d("CameraModule", "Parameters - facing: $facing")
            
            try {
                val context = appContext.reactContext
                if (context == null) {
                    saveDebugLog("ERROR: Context is null")
                    Log.e("CameraModule", "ERROR: Context is null")
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                saveDebugLog("✓ Context OK")
                Log.d("CameraModule", "✓ Context OK")

                val activity = appContext.currentActivity
                if (activity == null) {
                    saveDebugLog("ERROR: Activity is null")
                    Log.e("CameraModule", "ERROR: Activity is null")
                    promise.resolve(mapOf("success" to false, "error" to "Activity not available"))
                    return@AsyncFunction
                }
                saveDebugLog("✓ Activity OK")
                Log.d("CameraModule", "✓ Activity OK")
                
                val lifecycleOwner = activity as? LifecycleOwner
                if (lifecycleOwner == null) {
                    saveDebugLog("ERROR: LifecycleOwner is null")
                    Log.e("CameraModule", "ERROR: LifecycleOwner is null")
                    promise.resolve(mapOf("success" to false, "error" to "LifecycleOwner not available"))
                    return@AsyncFunction
                }
                saveDebugLog("✓ LifecycleOwner OK")
                Log.d("CameraModule", "✓ LifecycleOwner OK")
                
                // 권한 체크
                val cameraPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                if (cameraPermission != PackageManager.PERMISSION_GRANTED) {
                    saveDebugLog("ERROR: Camera permission not granted")
                    Log.e("CameraModule", "ERROR: Camera permission not granted")
                    promise.resolve(mapOf("success" to false, "error" to "Camera permission not granted"))
                    return@AsyncFunction
                }
                saveDebugLog("✓ Camera permission OK")
                Log.d("CameraModule", "✓ Camera permission OK")
                
                currentFacing = facing
                
                // 기존 카메라 정리
                saveDebugLog("Cleaning up previous camera...")
                Log.d("CameraModule", "Cleaning up previous camera...")
                cleanupCamera()
                
                saveDebugLog("Getting ProcessCameraProvider...")
                Log.d("CameraModule", "Getting ProcessCameraProvider...")
                // Activity Context를 사용해야 디스플레이 정보를 가져올 수 있음
                val cameraProviderFuture = ProcessCameraProvider.getInstance(activity)
                
                cameraProviderFuture.addListener({
                    try {
                        saveDebugLog("Camera provider future completed")
                        Log.d("CameraModule", "Camera provider future completed")
                        cameraProvider = cameraProviderFuture.get()
                        saveDebugLog("✓ CameraProvider obtained")
                        Log.d("CameraModule", "✓ CameraProvider obtained")
                        
                        // 모든 기존 바인딩 해제
                        cameraProvider?.unbindAll()
                        saveDebugLog("✓ Previous bindings unbound")
                        Log.d("CameraModule", "✓ Previous bindings unbound")

                        // 카메라 선택
                        val cameraSelector = if (facing == "front") {
                            saveDebugLog("Using FRONT camera")
                            Log.d("CameraModule", "Using FRONT camera")
                            CameraSelector.DEFAULT_FRONT_CAMERA
                        } else {
                            saveDebugLog("Using BACK camera")
                            Log.d("CameraModule", "Using BACK camera")
                            CameraSelector.DEFAULT_BACK_CAMERA
                        }

                        // ImageCapture 설정 (가장 안정적인 설정)
                        saveDebugLog("Creating ImageCapture...")
                        Log.d("CameraModule", "Creating ImageCapture...")
                        
                        // 화면 회전 가져오기 (deprecated 방지) - Activity에서 가져와야 함
                        val rotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            activity.display?.rotation ?: Surface.ROTATION_0
                        } else {
                            @Suppress("DEPRECATION")
                            activity.windowManager.defaultDisplay.rotation
                        }
                        
                        imageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                            .setTargetRotation(rotation)
                            .build()
                        saveDebugLog("✓ ImageCapture created")
                        Log.d("CameraModule", "✓ ImageCapture created")

                        val useCases = mutableListOf<UseCase>(imageCapture!!)

                        // 프레임 스트리밍 설정
                        saveDebugLog("Setting up frame streaming...")
                        Log.d("CameraModule", "Setting up frame streaming...")
                        isStreaming = true
                        lastFrameTime = 0L

                        imageAnalyzer = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .setTargetRotation(rotation)
                            .build()
                        
                        imageAnalyzer?.setAnalyzer(cameraExecutor) { imageProxy ->
                            processFrame(imageProxy)
                        }
                        
                        useCases.add(imageAnalyzer!!)
                        saveDebugLog("✓ ImageAnalyzer added")
                        Log.d("CameraModule", "✓ ImageAnalyzer added")

                        // 카메라 바인딩
                        saveDebugLog("Binding ${useCases.size} use cases to lifecycle...")
                        Log.d("CameraModule", "Binding ${useCases.size} use cases to lifecycle...")
                        camera = cameraProvider?.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            *useCases.toTypedArray()
                        )

                        if (camera != null) {
                            saveDebugLog("✓✓✓ Camera started successfully ✓✓✓")
                            Log.d("CameraModule", "✓✓✓ Camera started successfully ✓✓✓")
                            
                            promise.resolve(mapOf(
                                "success" to true,
                                "isActive" to true,
                                "facing" to facing,
                                "isRecording" to false,
                                "isStreaming" to isStreaming
                            ))
                        } else {
                            saveDebugLog("ERROR: Camera object is null after binding")
                            Log.e("CameraModule", "ERROR: Camera object is null after binding")
                            promise.resolve(mapOf("success" to false, "error" to "Camera binding returned null"))
                        }

                            } catch (e: Exception) {
                                saveDebugLog("ERROR in camera provider listener: ${e.message}")
                                saveDebugLog("Stack trace: ${e.stackTraceToString()}")
                                Log.e("CameraModule", "ERROR in camera provider listener", e)
                                Log.e("CameraModule", "Stack trace: ${e.stackTraceToString()}")
                                saveCrashLog("Camera binding error", e)
                                cleanupCamera()
                                promise.resolve(mapOf("success" to false, "error" to "Camera binding failed: ${e.message}"))
                            }
                    }, ContextCompat.getMainExecutor(context))
                    
            } catch (e: Exception) {
                saveDebugLog("ERROR in startCamera: ${e.message}")
                saveDebugLog("Stack trace: ${e.stackTraceToString()}")
                Log.e("CameraModule", "ERROR in startCamera", e)
                Log.e("CameraModule", "Stack trace: ${e.stackTraceToString()}")
                saveCrashLog("startCamera error", e)
                cleanupCamera()
                promise.resolve(mapOf("success" to false, "error" to "Failed to start camera: ${e.message}"))
            }
        }

        // 카메라 중지
        AsyncFunction("stopCamera") { promise: Promise ->
            try {
                saveDebugLog("=== stopCamera called ===")
                Log.d("CameraModule", "=== stopCamera called ===")
                cleanupCamera()
                saveDebugLog("✓ Camera stopped successfully")
                Log.d("CameraModule", "✓ Camera stopped successfully")
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                saveDebugLog("ERROR stopCamera: ${e.message}")
                Log.e("CameraModule", "stopCamera error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 비디오 녹화 시작 (선택적 기능)
        AsyncFunction("startRecording") { promise: Promise ->
            try {
                if (camera == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Camera not started"))
                    return@AsyncFunction
                }
                
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                // VideoCapture가 없으면 새로 생성
                if (videoCapture == null) {
                    val lifecycleOwner = appContext.currentActivity as? LifecycleOwner
                    if (lifecycleOwner == null) {
                        promise.resolve(mapOf("success" to false, "error" to "Activity not available"))
                        return@AsyncFunction
                    }
                    
                    val recorder = Recorder.Builder()
                        .setQualitySelector(QualitySelector.from(Quality.HD))
                        .build()
                    videoCapture = VideoCapture.withOutput(recorder)
                    
                    // 카메라를 다시 바인딩 (기존 UseCase + VideoCapture)
                    cameraProvider?.unbindAll()
                    
                    val useCases = mutableListOf<UseCase>()
                    imageCapture?.let { useCases.add(it) }
                    imageAnalyzer?.let { useCases.add(it) }
                    useCases.add(videoCapture!!)
                    
                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
                    camera = cameraProvider?.bindToLifecycle(
                        lifecycleOwner,
                        cameraSelector,
                        *useCases.toTypedArray()
                    )
                }
                
                startVideoRecording(promise)
                
            } catch (e: Exception) {
                Log.e("CameraModule", "startRecording error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 비디오 녹화 중지
        AsyncFunction("stopRecording") { promise: Promise ->
            try {
                recording?.stop()
                recording = null
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "stopRecording error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 상태 확인
        AsyncFunction("getCameraStatus") { promise: Promise ->
            try {
                promise.resolve(mapOf(
                    "isRecording" to (recording != null),
                    "isStreaming" to isStreaming,
                    "hasCamera" to (camera != null)
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "getCameraStatus error", e)
                promise.resolve(mapOf(
                    "isRecording" to false,
                    "isStreaming" to false,
                    "hasCamera" to false
                ))
            }
        }
        
        // 크래시 로그 파일 목록 가져오기
        AsyncFunction("getCrashLogs") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val crashFiles = logsDir?.listFiles { file -> 
                    file.name.startsWith("camera_crash_") && file.name.endsWith(".txt")
                }?.sortedByDescending { it.lastModified() } ?: emptyList()
                
                val logList = crashFiles.map { file ->
                    mapOf(
                        "name" to file.name,
                        "path" to file.absolutePath,
                        "size" to file.length(),
                        "date" to file.lastModified()
                    )
                }
                
                promise.resolve(mapOf(
                    "success" to true,
                    "logs" to logList,
                    "count" to logList.size
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "getCrashLogs error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 크래시 로그 공유하기 (카카오톡, 이메일 등으로 전송)
        AsyncFunction("shareCrashLog") { filePath: String, promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val file = File(filePath)
                if (!file.exists()) {
                    promise.resolve(mapOf("success" to false, "error" to "File not found"))
                    return@AsyncFunction
                }
                
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )
                
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, "Camera Crash Log - ${file.name}")
                    putExtra(Intent.EXTRA_TEXT, "카메라 모듈 크래시 로그입니다.")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                val chooser = Intent.createChooser(shareIntent, "크래시 로그 공유").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                context.startActivity(chooser)
                
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "shareCrashLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 디버그 로그 가져오기
        AsyncFunction("getDebugLog") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val logFile = File(logsDir, "camera_debug.log")
                
                if (!logFile.exists()) {
                    promise.resolve(mapOf(
                        "success" to true,
                        "content" to "",
                        "path" to logFile.absolutePath,
                        "exists" to false
                    ))
                    return@AsyncFunction
                }
                
                val content = logFile.readText()
                
                promise.resolve(mapOf(
                    "success" to true,
                    "content" to content,
                    "path" to logFile.absolutePath,
                    "size" to logFile.length(),
                    "exists" to true
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "getDebugLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 디버그 로그 공유하기
        AsyncFunction("shareDebugLog") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val logFile = File(logsDir, "camera_debug.log")
                
                if (!logFile.exists()) {
                    promise.resolve(mapOf("success" to false, "error" to "Debug log file not found"))
                    return@AsyncFunction
                }
                
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    logFile
                )
                
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, "Camera Debug Log")
                    putExtra(Intent.EXTRA_TEXT, "카메라 디버그 로그입니다.")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                val chooser = Intent.createChooser(shareIntent, "디버그 로그 공유").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                context.startActivity(chooser)
                
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "shareDebugLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 디버그 로그 삭제
        AsyncFunction("clearDebugLog") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val logFile = File(logsDir, "camera_debug.log")
                
                val deleted = if (logFile.exists()) {
                    logFile.delete()
                } else {
                    true
                }
                
                promise.resolve(mapOf(
                    "success" to deleted,
                    "message" to if (deleted) "Debug log cleared" else "Failed to delete debug log"
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "clearDebugLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 모든 크래시 로그 삭제
        AsyncFunction("clearCrashLogs") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val crashFiles = logsDir?.listFiles { file -> 
                    file.name.startsWith("camera_crash_") && file.name.endsWith(".txt")
                } ?: emptyArray()
                
                var deletedCount = 0
                crashFiles.forEach { file ->
                    if (file.delete()) deletedCount++
                }
                
                promise.resolve(mapOf(
                    "success" to true,
                    "deleted" to deletedCount
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "clearCrashLogs error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
    }

    private fun startVideoRecording(promise: Promise) {
        try {
            val context = appContext.reactContext ?: run {
                promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                return
            }
            
            val videoCapture = this.videoCapture ?: run {
                promise.resolve(mapOf("success" to false, "error" to "Video capture not initialized"))
                return
            }

            val videoFile = File.createTempFile("video_", ".mp4", context.cacheDir)
            val outputOptions = FileOutputOptions.Builder(videoFile).build()

            val micPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            
            var pendingRecording = videoCapture.output.prepareRecording(context, outputOptions)
            
            if (micPermission == PackageManager.PERMISSION_GRANTED) {
                pendingRecording = pendingRecording.withAudioEnabled()
            }

            recording = pendingRecording.start(ContextCompat.getMainExecutor(context)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        Log.d("CameraModule", "Recording started")
                        promise.resolve(mapOf(
                            "success" to true,
                            "isRecording" to true,
                            "isStreaming" to isStreaming
                        ))
                    }
                    is VideoRecordEvent.Finalize -> {
                        if (!recordEvent.hasError()) {
                            sendEvent("onRecordingFinished", mapOf("path" to videoFile.absolutePath))
                        } else {
                            Log.e("CameraModule", "Recording error: ${recordEvent.error}")
                            sendEvent("onRecordingError", mapOf("error" to "Video error: ${recordEvent.error}"))
                        }
                        recording = null
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("CameraModule", "startVideoRecording error", e)
            promise.resolve(mapOf("success" to false, "error" to "Recording failed: ${e.message}"))
        }
    }

    private fun processFrame(imageProxy: ImageProxy) {
        try {
            saveDebugLog("processFrame called - isStreaming: $isStreaming")
            Log.d("CameraModule", "processFrame called - isStreaming: $isStreaming")
            
            if (!isStreaming) {
                saveDebugLog("Frame skipped - streaming disabled")
                Log.w("CameraModule", "Frame skipped - streaming disabled")
                imageProxy.close()
                return
            }

            val currentTime = System.currentTimeMillis()
            if (currentTime - lastFrameTime < FRAME_INTERVAL_MS) {
                imageProxy.close()
                return
            }
            lastFrameTime = currentTime
            
            saveDebugLog("Processing frame - converting to bitmap...")
            Log.d("CameraModule", "Processing frame - converting to bitmap...")

            val bitmap = imageProxy.toBitmap()
            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            
            val rotatedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)

            val out = ByteArrayOutputStream()
            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 30, out)
            val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            
            saveDebugLog("Frame encoded - size: ${base64.length} bytes, sending event...")
            Log.d("CameraModule", "Frame encoded - size: ${base64.length} bytes, sending event...")

            mainHandler.post {
                try {
                    sendEvent("onCameraFrame", mapOf(
                        "type" to "cameraFrame",
                        "base64" to "data:image/jpeg;base64,$base64",
                        "width" to rotatedBitmap.width,
                        "height" to rotatedBitmap.height
                    ))
                    saveDebugLog("✓ Frame sent via onCameraFrame")
                    Log.d("CameraModule", "✓ Frame sent via onCameraFrame")
                } catch (e: Exception) {
                    saveDebugLog("Failed to send frame event: ${e.message}")
                    Log.e("CameraModule", "Failed to send frame event", e)
                }
            }

            bitmap.recycle()
            rotatedBitmap.recycle()

        } catch (e: Exception) {
            saveDebugLog("processFrame error: ${e.message}")
            Log.e("CameraModule", "processFrame error", e)
        } finally {
            imageProxy.close()
        }
    }
    
    // 안전한 카메라 정리 함수
    private fun cleanupCamera() {
        try {
            saveDebugLog("=== cleanupCamera START ===")
            Log.d("CameraModule", "=== cleanupCamera START ===")
            
            saveDebugLog("Setting isStreaming = false")
            isStreaming = false
            
            // ImageAnalyzer의 분석기를 먼저 제거
            imageAnalyzer?.let {
                try {
                    saveDebugLog("Clearing image analyzer...")
                    it.clearAnalyzer()
                    saveDebugLog("✓ Image analyzer cleared")
                } catch (e: Exception) {
                    saveDebugLog("Error clearing analyzer: ${e.message}")
                    Log.e("CameraModule", "Error clearing analyzer", e)
                }
            }
            
            recording?.let {
                try {
                    saveDebugLog("Stopping recording...")
                    it.stop()
                    saveDebugLog("✓ Recording stopped")
                    Log.d("CameraModule", "✓ Recording stopped")
                } catch (e: Exception) {
                    saveDebugLog("Error stopping recording: ${e.message}")
                    Log.e("CameraModule", "Error stopping recording", e)
                }
            }
            recording = null

            cameraProvider?.let { provider ->
                try {
                    saveDebugLog("Unbinding all use cases...")
                    // 메인 스레드에서 unbind 실행
                    mainHandler.post {
                        try {
                            provider.unbindAll()
                            saveDebugLog("✓ Camera unbound")
                            Log.d("CameraModule", "✓ Camera unbound")
                        } catch (e: Exception) {
                            saveDebugLog("Error unbinding camera: ${e.message}")
                            Log.e("CameraModule", "Error unbinding camera", e)
                        }
                    }
                } catch (e: Exception) {
                    saveDebugLog("Error posting unbind: ${e.message}")
                    Log.e("CameraModule", "Error posting unbind", e)
                }
            }
            
            camera = null
            imageCapture = null
            videoCapture = null
            imageAnalyzer = null
            
            saveDebugLog("✓✓✓ Cleanup completed ✓✓✓")
            Log.d("CameraModule", "✓✓✓ Cleanup completed ✓✓✓")
        } catch (e: Exception) {
            saveDebugLog("ERROR in cleanupCamera: ${e.message}")
            Log.e("CameraModule", "Error in cleanupCamera", e)
        }
    }
    
    // 크래시 핸들러 설정
    private fun setupCrashHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                Log.e("CameraModule", "FATAL CRASH DETECTED!", throwable)
                saveCrashLog("FATAL CRASH", throwable)
            } catch (e: Exception) {
                Log.e("CameraModule", "Failed to save crash log", e)
            } finally {
                defaultHandler?.uncaughtException(thread, throwable)
            }
        }
    }
    
    // 디버그 로그를 파일로 저장 (실시간 디버깅용)
    private fun saveDebugLog(message: String) {
        try {
            val context = appContext.reactContext ?: return
            val logsDir = context.getExternalFilesDir(null) ?: return
            
            val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault()).format(Date())
            val logFile = File(logsDir, "camera_debug.log")
            
            // 파일이 너무 크면 새로 시작 (5MB 제한)
            if (logFile.exists() && logFile.length() > 5 * 1024 * 1024) {
                logFile.delete()
            }
            
            FileWriter(logFile, true).use { writer ->
                writer.appendLine("[$timestamp] $message")
            }
        } catch (e: Exception) {
            Log.e("CameraModule", "saveDebugLog error", e)
        }
    }
    
    // 크래시 로그를 파일로 저장
    private fun saveCrashLog(context: String, throwable: Throwable) {
        try {
            val ctx = appContext.reactContext ?: return
            
            val timestamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault()).format(Date())
            val fileName = "camera_crash_${timestamp}.txt"
            val logFile = File(ctx.getExternalFilesDir(null), fileName)
            
            FileWriter(logFile, true).use { writer ->
                PrintWriter(writer).use { printer ->
                    printer.println("=".repeat(80))
                    printer.println("CAMERA MODULE CRASH LOG")
                    printer.println("=".repeat(80))
                    printer.println("Timestamp: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault()).format(Date())}")
                    printer.println("Context: $context")
                    printer.println("Thread: ${Thread.currentThread().name}")
                    printer.println("-".repeat(80))
                    printer.println("ERROR MESSAGE:")
                    printer.println(throwable.message ?: "No message")
                    printer.println("-".repeat(80))
                    printer.println("STACK TRACE:")
                    throwable.printStackTrace(printer)
                    printer.println("=".repeat(80))
                    printer.println()
                    printer.println("앱에서 크래시 로그를 확인하고 공유하려면:")
                    printer.println("1. 앱 설정 또는 디버그 메뉴에서 '크래시 로그 보기' 선택")
                    printer.println("2. '로그 공유' 버튼을 눌러 카카오톡, 이메일 등으로 전송")
                    printer.println("3. 또는 파일 관리자에서 다음 경로로 접근:")
                    printer.println("   ${logFile.absolutePath}")
                    printer.println("=".repeat(80))
                }
            }
            
            Log.e("CameraModule", "💾 Crash log saved: ${logFile.absolutePath}")
            Log.e("CameraModule", "📱 Use getCrashLogs() and shareCrashLog() to access from app")
            
        } catch (e: Exception) {
            Log.e("CameraModule", "Failed to write crash log to file", e)
        }
    }
}
