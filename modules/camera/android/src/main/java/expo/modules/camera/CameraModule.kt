package expo.modules.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.YuvImage
import android.os.Handler
import android.os.Looper
import android.util.Base64
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
import java.util.concurrent.Executor

class CameraModule : Module() {
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null
    private var imageAnalyzer: ImageAnalysis? = null
    private var isStreaming = false
    private var streamingEventName: String? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val executor: Executor = ContextCompat.getMainExecutor(appContext.reactContext!!)

    override fun definition() = ModuleDefinition {
        Name("Camera")

        Events("onCameraFrame", "onRecordingFinished", "onRecordingError")

        // 카메라 권한 확인
        AsyncFunction("checkCameraPermission") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf(
                        "granted" to false,
                        "status" to "unavailable"
                    ))
                    return@AsyncFunction
                }

                val cameraGranted = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED

                val micGranted = ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED

                promise.resolve(mapOf(
                    "granted" to (cameraGranted && micGranted),
                    "cameraGranted" to cameraGranted,
                    "micGranted" to micGranted,
                    "status" to if (cameraGranted && micGranted) "granted" else "denied"
                ))
            } catch (e: Exception) {
                promise.resolve(mapOf(
                    "granted" to false,
                    "status" to "error",
                    "error" to e.message
                ))
            }
        }

        // 사진 촬영
        AsyncFunction("takePhoto") { promise: Promise ->
            try {
                if (imageCapture == null) {
                    promise.resolve(mapOf(
                        "success" to false,
                        "error" to "Camera not initialized"
                    ))
                    return@AsyncFunction
                }

                val photoFile = File.createTempFile(
                    "photo_",
                    ".jpg",
                    appContext.reactContext?.cacheDir
                )

                val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                imageCapture?.takePicture(
                    outputOptions,
                    executor,
                    object : ImageCapture.OnImageSavedCallback {
                        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                            promise.resolve(mapOf(
                                "success" to true,
                                "path" to photoFile.absolutePath
                            ))
                        }

                        override fun onError(exception: ImageCaptureException) {
                            promise.resolve(mapOf(
                                "success" to false,
                                "error" to exception.message
                            ))
                        }
                    }
                )
            } catch (e: Exception) {
                promise.resolve(mapOf(
                    "success" to false,
                    "error" to e.message
                ))
            }
        }

        // 카메라 시작 (비디오 녹화 + 옵션으로 프레임 스트리밍)
        AsyncFunction("startCamera") { facing: String, eventKey: String?, promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf(
                        "success" to false,
                        "error" to "Context not available"
                    ))
                    return@AsyncFunction
                }

                val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
                
                cameraProviderFuture.addListener({
                    try {
                        cameraProvider = cameraProviderFuture.get()
                        
                        val lifecycleOwner = appContext.currentActivity as? LifecycleOwner ?: run {
                            promise.resolve(mapOf(
                                "success" to false,
                                "error" to "Activity not available"
                            ))
                            return@addListener
                        }

                        // Unbind all use cases before rebinding
                        cameraProvider?.unbindAll()

                        // Camera selector
                        val cameraSelector = if (facing == "front") {
                            CameraSelector.DEFAULT_FRONT_CAMERA
                        } else {
                            CameraSelector.DEFAULT_BACK_CAMERA
                        }

                        // Image capture
                        imageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                            .build()

                        // Video capture
                        val recorder = Recorder.Builder()
                            .setQualitySelector(QualitySelector.from(Quality.HD))
                            .build()
                        videoCapture = VideoCapture.withOutput(recorder)

                        // Image analyzer for frame streaming
                        if (eventKey != null) {
                            streamingEventName = eventKey
                            isStreaming = true
                            
                            imageAnalyzer = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .also { analyzer ->
                                    analyzer.setAnalyzer(executor) { imageProxy ->
                                        if (isStreaming) {
                                            processFrame(imageProxy)
                                        }
                                        imageProxy.close()
                                    }
                                }

                            camera = cameraProvider?.bindToLifecycle(
                                lifecycleOwner,
                                cameraSelector,
                                imageCapture,
                                videoCapture,
                                imageAnalyzer
                            )
                        } else {
                            camera = cameraProvider?.bindToLifecycle(
                                lifecycleOwner,
                                cameraSelector,
                                imageCapture,
                                videoCapture
                            )
                        }

                        // Start video recording
                        startVideoRecording(promise)

                    } catch (e: Exception) {
                        promise.resolve(mapOf(
                            "success" to false,
                            "error" to e.message
                        ))
                    }
                }, executor)

            } catch (e: Exception) {
                promise.resolve(mapOf(
                    "success" to false,
                    "error" to e.message
                ))
            }
        }

        // 카메라 중지
        AsyncFunction("stopCamera") { promise: Promise ->
            try {
                isStreaming = false
                streamingEventName = null
                
                recording?.stop()
                recording = null

                cameraProvider?.unbindAll()
                
                promise.resolve(mapOf(
                    "success" to true
                ))
            } catch (e: Exception) {
                promise.resolve(mapOf(
                    "success" to false,
                    "error" to e.message
                ))
            }
        }

        // 상태 확인
        AsyncFunction("getCameraStatus") { promise: Promise ->
            promise.resolve(mapOf(
                "isRecording" to (recording != null),
                "isStreaming" to isStreaming,
                "hasCamera" to (camera != null)
            ))
        }
    }

    private fun startVideoRecording(promise: Promise) {
        try {
            val context = appContext.reactContext ?: return
            val videoCapture = this.videoCapture ?: return

            val videoFile = File.createTempFile(
                "video_",
                ".mp4",
                context.cacheDir
            )

            val outputOptions = FileOutputOptions.Builder(videoFile).build()

            recording = videoCapture.output
                .prepareRecording(context, outputOptions)
                .withAudioEnabled()
                .start(executor) { recordEvent ->
                    when (recordEvent) {
                        is VideoRecordEvent.Start -> {
                            promise.resolve(mapOf(
                                "success" to true,
                                "isRecording" to true,
                                "isStreaming" to isStreaming
                            ))
                        }
                        is VideoRecordEvent.Finalize -> {
                            if (!recordEvent.hasError()) {
                                sendEvent("onRecordingFinished", mapOf(
                                    "path" to videoFile.absolutePath
                                ))
                            } else {
                                sendEvent("onRecordingError", mapOf(
                                    "error" to recordEvent.cause?.message
                                ))
                            }
                        }
                    }
                }
        } catch (e: Exception) {
            promise.resolve(mapOf(
                "success" to false,
                "error" to e.message
            ))
        }
    }

    private fun processFrame(imageProxy: ImageProxy) {
        try {
            if (!isStreaming || streamingEventName == null) return

            val buffer = imageProxy.planes[0].buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)

            // Convert to JPEG
            val yuvImage = YuvImage(
                imageProxy.planes[0].buffer.array(),
                ImageFormat.NV21,
                imageProxy.width,
                imageProxy.height,
                null
            )

            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(
                android.graphics.Rect(0, 0, imageProxy.width, imageProxy.height),
                50,
                out
            )
            val imageBytes = out.toByteArray()

            // Rotate if needed
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            val rotatedBitmap = Bitmap.createBitmap(
                bitmap,
                0,
                0,
                bitmap.width,
                bitmap.height,
                matrix,
                true
            )

            // Convert to base64
            val finalOut = ByteArrayOutputStream()
            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 50, finalOut)
            val base64 = Base64.encodeToString(finalOut.toByteArray(), Base64.NO_WRAP)

            // Send to JS
            mainHandler.post {
                sendEvent(streamingEventName!!, mapOf(
                    "type" to "cameraFrame",
                    "base64" to "data:image/jpeg;base64,$base64",
                    "width" to rotatedBitmap.width,
                    "height" to rotatedBitmap.height,
                    "timestamp" to System.currentTimeMillis()
                ))
            }

            bitmap.recycle()
            rotatedBitmap.recycle()
        } catch (e: Exception) {
            // Silently ignore frame processing errors
        }
    }
}
