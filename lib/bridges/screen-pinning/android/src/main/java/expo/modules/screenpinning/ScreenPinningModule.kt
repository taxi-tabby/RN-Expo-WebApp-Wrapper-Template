package expo.modules.screenpinning

import android.app.Activity
import android.app.ActivityManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class ScreenPinningModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ScreenPinning")

        // 앱 고정 상태 확인
        AsyncFunction("isScreenPinned") { promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.resolve(mapOf(
                        "isPinned" to false,
                        "lockTaskModeState" to 0
                    ))
                    return@AsyncFunction
                }

                val activityManager = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                val lockTaskModeState = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    activityManager.lockTaskModeState
                } else {
                    @Suppress("DEPRECATION")
                    if (activityManager.isInLockTaskMode) 1 else 0
                }

                // LOCK_TASK_MODE_NONE = 0, LOCK_TASK_MODE_PINNED = 1, LOCK_TASK_MODE_LOCKED = 2
                promise.resolve(mapOf(
                    "isPinned" to (lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE),
                    "lockTaskModeState" to lockTaskModeState
                ))
            } catch (e: Exception) {
                promise.resolve(mapOf(
                    "isPinned" to false,
                    "lockTaskModeState" to 0,
                    "error" to e.message
                ))
            }
        }

        // 앱 고정 시작
        AsyncFunction("startScreenPinning") { promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.resolve(mapOf(
                        "success" to false,
                        "error" to "Activity not available"
                    ))
                    return@AsyncFunction
                }

                // startLockTask()는 사용자에게 확인 다이얼로그를 표시
                // Device Owner 앱인 경우 다이얼로그 없이 바로 고정됨
                activity.startLockTask()
                
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

        // 앱 고정 해제
        AsyncFunction("stopScreenPinning") { promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.resolve(mapOf(
                        "success" to false,
                        "error" to "Activity not available"
                    ))
                    return@AsyncFunction
                }

                // stopLockTask()는 Device Owner 앱에서만 프로그래밍 방식으로 해제 가능
                // 일반 앱은 뒤로가기 + 최근 앱 버튼 동시 길게 누르기로 해제
                activity.stopLockTask()
                
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
    }
}
