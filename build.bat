@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:MENU
cls
echo ============================================
echo         RNWebWrapper 빌드 스크립트
echo ============================================
echo.
echo  [1] 클라우드 빌드 (EAS Cloud)
echo  [2] 로컬 빌드 (Gradle 직접)
echo  [3] Gradle 캐시 정리
echo  [4] 종료
echo.
echo ============================================
echo  * Windows에서는 EAS --local 불가, Gradle 사용
echo ============================================
set /p choice="선택하세요 (1-4): "

if "%choice%"=="1" goto CLOUD_BUILD
if "%choice%"=="2" goto LOCAL_BUILD
if "%choice%"=="3" goto CLEAN
if "%choice%"=="4" goto END
echo.
echo [오류] 잘못된 선택입니다. 다시 선택해주세요.
timeout /t 2 >nul
goto MENU

:CLOUD_BUILD
cls
echo ============================================
echo         클라우드 빌드 프로필 선택
echo ============================================
echo.
echo  [1] development (개발용)
echo  [2] preview (테스트용 APK)
echo  [3] production (출시용 AAB)
echo  [4] 뒤로가기
echo.
set /p profile="선택하세요 (1-4): "

if "%profile%"=="1" set BUILD_PROFILE=development
if "%profile%"=="2" set BUILD_PROFILE=preview
if "%profile%"=="3" set BUILD_PROFILE=production
if "%profile%"=="4" goto MENU

if not defined BUILD_PROFILE (
    echo [오류] 잘못된 선택입니다.
    timeout /t 2 >nul
    goto CLOUD_BUILD
)

echo.
echo ▶ 클라우드 빌드 시작: %BUILD_PROFILE%
echo ============================================
call npx eas build --platform android --profile %BUILD_PROFILE%
echo.
echo ============================================
echo 빌드 완료!
pause
goto MENU

:LOCAL_BUILD
cls
echo ============================================
echo         로컬 빌드 (Gradle 직접)
echo ============================================
echo.
echo  [1] Debug APK (개발/테스트용)
echo  [2] Release APK (배포용)
echo  [3] Release AAB (Play Store용)
echo  [4] 뒤로가기
echo.
set /p profile="선택하세요 (1-4): "

if "%profile%"=="1" goto BUILD_DEBUG
if "%profile%"=="2" goto BUILD_RELEASE_APK
if "%profile%"=="3" goto BUILD_RELEASE_AAB
if "%profile%"=="4" goto MENU
echo [오류] 잘못된 선택입니다.
timeout /t 2 >nul
goto LOCAL_BUILD

:BUILD_DEBUG
echo.
echo ▶ Debug APK 빌드 시작...
echo ============================================
echo 플러그인 설정 중...
call node scripts\setup-plugins.js
call npx expo prebuild --platform android
cd android
call gradlew assembleDebug
cd ..
echo.
echo ============================================
echo 빌드 완료!
echo 결과물: android\app\build\outputs\apk\debug\app-debug.apk
pause
goto MENU

:BUILD_RELEASE_APK
echo.
echo ▶ Release APK 빌드 시작...
echo ============================================
echo 플러그인 설정 중...
call node scripts\setup-plugins.js
call npx expo prebuild --platform android
cd android
call gradlew assembleRelease
cd ..
echo.
echo ============================================
echo 빌드 완료!
echo 결과물: android\app\build\outputs\apk\release\app-release.apk
pause
goto MENU

:BUILD_RELEASE_AAB
echo.
echo ▶ Release AAB 빌드 시작...
echo ============================================
echo 플러그인 설정 중...
call node scripts\setup-plugins.js
call npx expo prebuild --platform android
cd android
call gradlew bundleRelease
cd ..
echo.
echo ============================================
echo 빌드 완료!
echo 결과물: android\app\build\outputs\bundle\release\app-release.aab
pause
goto MENU

:CLEAN
cls
echo ============================================
echo         Gradle 캐시 정리
echo ============================================
echo.
echo CMake 캐시 삭제 중...
if exist "android\app\.cxx" rmdir /s /q "android\app\.cxx"
if exist "android\app\build" rmdir /s /q "android\app\build"
echo.
echo Gradle 데몬 종료 중...
cd android
call gradlew --stop
echo.
echo Gradle 캐시 정리 중...
call gradlew clean
cd ..
echo.
echo ============================================
echo 정리 완료!
pause
goto MENU

:END
echo.
echo 종료합니다.
exit /b 0
