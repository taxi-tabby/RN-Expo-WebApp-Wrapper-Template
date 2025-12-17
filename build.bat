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
echo         로컬 빌드 프로필 선택
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
    goto LOCAL_BUILD
)

echo.
echo ▶ 로컬 빌드 시작: %BUILD_PROFILE%
echo ============================================
echo.
echo [팁] 메모리 부족 시 Gradle 캐시 정리(옵션 3)를 먼저 실행하세요.
echo.
call npx eas build --platform android --profile %BUILD_PROFILE% --local
echo.
echo ============================================
echo 빌드 완료! 결과물 위치 확인하세요.
pause
goto MENU

:CLEAN
cls
echo ============================================
echo         Gradle 캐시 정리
echo ============================================
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
