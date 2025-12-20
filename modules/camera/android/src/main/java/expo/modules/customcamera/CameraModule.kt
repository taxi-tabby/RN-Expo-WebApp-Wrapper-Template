package expo.modules.customcamera

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraModule : Module() {
    // 카메라 관련 변수
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null
    private var imageAnalyzer: ImageAnalysis? = null
    
    // 상태 변수
    private var isStreaming = false
    private var streamingEventName: String? = null
    
    // 스레드 핸들러
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
    
    // [수정] by lazy 관련 컴파일 에러 해결을 위해 Nullable var로 변경
    private var cameraExecutor: ExecutorService? = null

    // [수정] Executor를 안전하게 가져오는 헬퍼 프로퍼티
    private val executor: ExecutorService
        get() {
            if (cameraExecutor == null || cameraExecutor!!.isShutdown) {
                cameraExecutor = Executors.newSingleThreadExecutor()
            }
            return cameraExecutor!!
        }

    // 성능 최적화: FPS 제한
    private var lastFrameTime = 0L
    private val TARGET_FPS = 10.0 
    private val FRAME_INTERVAL_MS = (1000.0 / TARGET_FPS).toLong()

    override fun definition() = ModuleDefinition {
        Name("Camera")
        Events("onCameraFrame", "onRecordingFinished", "onRecordingError")

        OnCreate {
            Log.d("CameraModule", "Module created")
        }

        OnDestroy {
            try {
                isStreaming = false
                recording?.stop()
                recording = null
                cameraProvider?.unbindAll()
                
                // [수정] 컴파일 에러가 발생하던 부분 수정 (안전한 종료)
                cameraExecutor?.shutdown()
                cameraExecutor = null
                
            } catch (e: Exception) {
                Log.e("CameraModule", "OnDestroy error", e)
            }
        }

        AsyncFunction("checkCameraPermission") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.resolve(mapOf("granted" to false))
                return@AsyncFunction
            }
            val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            promise.resolve(mapOf("granted" to (cameraGranted && micGranted)))
        }

        AsyncFunction("takePhoto") { promise: Promise ->
            if (imageCapture == null) {
                promise.resolve(mapOf("success" to false, "error" to "Camera not initialized"))
                return@AsyncFunction
            }
            try {
                val photoFile = File.createTempFile("photo_", ".jpg", appContext.reactContext?.cacheDir)
                val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                // executor 헬퍼 사용
                imageCapture?.takePicture(outputOptions, executor, object : ImageCapture.OnImageSavedCallback {
                    override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                        promise.resolve(mapOf("success" to true, "path" to photoFile.absolutePath))
                    }
                    override fun onError(exception: ImageCaptureException) {
                        promise.resolve(mapOf("success" to false, "error" to exception.message))
                    }
                })
            } catch (e: Exception) {
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        AsyncFunction("startCamera") { facing: String, eventKey: String?, promise: Promise ->
            val context = appContext.reactContext ?: return@AsyncFunction
            
            mainHandler.post {
                try {
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
                    cameraProviderFuture.addListener({
                        try {
                            cameraProvider = cameraProviderFuture.get()
                            val lifecycleOwner = appContext.currentActivity as? LifecycleOwner
                            if (lifecycleOwner == null) {
                                promise.resolve(mapOf("success" to false, "error" to "LifecycleOwner is null"))
                                return@addListener
                            }

                            cameraProvider?.unbindAll()

                            val cameraSelector = if (facing == "front") CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA

                            imageCapture = ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build()

                            val recorder = Recorder.Builder().setQualitySelector(QualitySelector.from(Quality.HD)).build()
                            videoCapture = VideoCapture.withOutput(recorder)

                            val useCases = mutableListOf<UseCase>(imageCapture!!, videoCapture!!)

                            if (eventKey != null) {
                                streamingEventName = eventKey
                                isStreaming = true
                                lastFrameTime = 0L

                                imageAnalyzer = ImageAnalysis.Builder()
                                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                    .setTargetResolution(Size(480, 640)) 
                                    .build()
                                    .also { analyzer ->
                                        // executor 헬퍼 사용
                                        analyzer.setAnalyzer(executor) { imageProxy ->
                                            processFrameSafe(imageProxy)
                                        }
                                    }
                                useCases.add(imageAnalyzer!!)
                            }

                            camera = cameraProvider?.bindToLifecycle(lifecycleOwner, cameraSelector, *useCases.toTypedArray())
                            startVideoRecording(promise)

                        } catch (e: Exception) {
                            promise.resolve(mapOf("success" to false, "error" to e.message))
                        }
                    }, ContextCompat.getMainExecutor(context))
                } catch (e: Exception) {
                    promise.resolve(mapOf("success" to false, "error" to e.message))
                }
            }
        }

        AsyncFunction("stopCamera") { promise: Promise ->
            try {
                isStreaming = false
                recording?.stop()
                recording = null
                mainHandler.post {
                    try {
                        cameraProvider?.unbindAll()
                    } catch (e: Exception) { Log.e("CameraModule", "Unbind failed", e) }
                }
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
    }

    private fun startVideoRecording(promise: Promise) {
        val context = appContext.reactContext ?: return
        val videoCapture = this.videoCapture ?: return

        try {
            val videoFile = File.createTempFile("video_", ".mp4", context.cacheDir)
            val outputOptions = FileOutputOptions.Builder(videoFile).build()
            
            val permission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            
            var pendingRecording = videoCapture.output.prepareRecording(context, outputOptions)
            if (permission == PackageManager.PERMISSION_GRANTED) {
                pendingRecording = pendingRecording.withAudioEnabled()
            }

            recording = pendingRecording.start(ContextCompat.getMainExecutor(context)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        promise.resolve(mapOf("success" to true, "isRecording" to true))
                    }
                    is VideoRecordEvent.Finalize -> {
                        if (!recordEvent.hasError()) {
                            sendEvent("onRecordingFinished", mapOf("path" to videoFile.absolutePath))
                        } else {
                            recording = null
                            sendEvent("onRecordingError", mapOf("error" to "Video error: ${recordEvent.error}"))
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("CameraModule", "Video start failed", e)
        }
    }

    private fun processFrameSafe(imageProxy: ImageProxy) {
        if (!isStreaming || streamingEventName == null) {
            imageProxy.close()
            return
        }

        val currentTime = System.currentTimeMillis()
        if (currentTime - lastFrameTime < FRAME_INTERVAL_MS) {
            imageProxy.close()
            return
        }
        lastFrameTime = currentTime

        try {
            val buffer = imageProxy.planes[0].buffer
            buffer.rewind()
            
            val bitmap = Bitmap.createBitmap(imageProxy.width, imageProxy.height, Bitmap.Config.ARGB_8888)
            bitmap.copyPixelsFromBuffer(buffer)

            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            
            val scale = if (bitmap.width > 640) 640f / bitmap.width else 1f
            if (scale != 1f) {
                matrix.postScale(scale, scale)
            }

            val rotatedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            
            val outputStream = ByteArrayOutputStream()
            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 30, outputStream)
            val base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)

            mainHandler.post {
                sendEvent(streamingEventName!!, mapOf(
                    "type" to "cameraFrame",
                    "base64" to "data:image/jpeg;base64,$base64",
                    "width" to rotatedBitmap.width,
                    "height" to rotatedBitmap.height
                ))
            }

            bitmap.recycle()
            rotatedBitmap.recycle()

        } catch (e: Exception) {
            Log.e("CameraModule", "Frame processing error: ${e.message}")
        } finally {
            imageProxy.close()
        }
    }
}