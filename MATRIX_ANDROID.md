# Matrix: Android development APK

## Что подготовлено

- Базовые версии сохранены: Expo 57.0.26, React 19.2.3, React Native 0.86.3.
- `@unomed/react-native-matrix-sdk` зафиксирован строго на `0.10.2` в package.json и package-lock.json.
- `expo-dev-client` 57.0.19 установлен через `npx expo install`.
- Минимальный экран использует Expo Router, как требует AGENTS.md. Для Router установлены совместимые зависимости Expo 57, включая Safe Area, Screens, Linking, Constants, Expo UI, Reanimated 4.5.1 и Worklets 0.10.1. React DOM согласован с React: 19.2.3.
- Профиль `development` в eas.json: `developmentClient: true`, `distribution: internal`, Android `buildType: apk`.
- Android application ID: `com.watchermatrixcheck.dev`. Это идентификатор тестового прототипа.
- `expo-build-properties` ограничивает ABI на `arm64-v8a` и `armeabi-v7a`. x86/x86_64 не поддерживаются поставляемыми Matrix-бинарниками.
- Локальные нативные папки `android/` и `ios/` не создавались и не редактировались. Android-проект сгенерирован EAS при облачной сборке.

## Проверка исходников 0.10.2

Изучен именно npm-архив 0.10.2, скачанный через `npm pack --ignore-scripts` до установки. Его registry gitHead: `fb1204910ac43de120955ea56a84a170db5d0ba1`.

Прочитаны README, package.json, scripts/download-binaries.js, scripts/package-binaries.js, react-native.config.js, Android Gradle/CMake, Kotlin TurboModule и package, JNI-адаптер, поставляемый codegen, src/index.tsx, NativeReactNativeMatrixSdk.ts и сгенерированные JS/TypeScript/C++ FFI.

Факты о совместимости:

- Это TurboModule с JSI/UniFFI и matrix-rust-sdk, а не JS Matrix-клиент. `TurboModuleRegistry.getEnforcing('ReactNativeMatrixSdk')` требует модуль внутри APK.
- Импорт устанавливает Rust crate в Hermes и проверяет UniFFI-контракт/контрольные суммы API. `uniffiInitAsync()` на native — пустая функция; её успешное выполнение не считается проверкой SDK.
- `sdkGitSha()` вызывает нативную функцию `ubrn_uniffi_matrix_sdk_ffi_fn_func_sdk_git_sha`. `isRoomAliasFormatValid()` вызывает `ubrn_uniffi_matrix_sdk_ffi_fn_func_is_room_alias_format_valid`; это не локальная JS-проверка.
- Kotlin выполняет `System.loadLibrary('unomed-react-native-matrix-sdk')`; CMake связывает этот адаптер с `libmatrix_sdk_ffi.so` нужной ABI.
- Пакет включает сгенерированный codegen (`includesGeneratedCode: true`) и ARM `.so`. RN autolinking обнаруживает package и generated/jni/CMakeLists.txt.
- Разработческие зависимости самой библиотеки: React 18.3.1 и RN 0.76.9. `peerDependencies: '*'`, существование TurboModule и присутствие старых JNI/API в RN 0.86.3 не доказывают бинарную/исходную совместимость. Первая EAS-сборка подтвердила успешную Gradle/Kotlin/C++/JNI-компиляцию для обеих ARM ABI. Затем пользовательский скриншот с Tecno подтвердил загрузку модуля и реальные вызовы `sdkGitSha()` и `isRoomAliasFormatValid()` на этом устройстве с RN 0.86.3; остальные методы и устройства не проверены.
- Android CMake учитывает объединённую библиотеку RN >= 0.76 и задаёт 16 КБ alignment. У скачанных Rust `.so` все PT_LOAD-сегменты имеют alignment 16384. Это проверка файлов, а не всей собранной APK или работы на устройстве с 16 КБ страницами.

Установка:

- `postinstall` пакета: `patch-package && node scripts/download-binaries.js`. В опубликованном архиве отсутствует каталог `patches`; при установке получено `No patch files found`. Локальная генерация Rust/`yarn generate` не запускалась.
- Загрузчик получает `https://github.com/unomed-dev/react-native-matrix-sdk/releases/download/0.10.2/binaries.tar.gz`, распаковывает его в пакет. Он проверяет только наличие iOS xcframework для пропуска загрузки; отдельного Android skip или проверки хеша архива нет.
- При ошибке скачивания загрузчик завершает процесс с кодом 0. Поэтому добавлена отдельная проверка версии пакета, существования и ELF-архитектуры обеих Android `.so` после установки и в EAS `eas-build-post-install`.
- Здесь загрузка завершилась сообщением `Binaries downloaded successfully!`; iOS xcframework и оба Android `.so` присутствуют. SHA256 arm64 `.so` из npm-архива и после загрузки совпал: `f288a98910842ad477c9b47307893756a2a568d00adaf8afd40cef1a1f8e475b`.
- `postinstall-postinstall` 2.1.0 повторно запускает корневой postinstall, если он есть; наш обработчик только проверяет Android-бинарники.

## Результаты локальных проверок — 3 октября 2026

- `npx tsc --noEmit`: пройдено.
- `npx expo lint`: пройдено, без ошибок и предупреждений.
- `npx expo-doctor`: 21/21, No issues detected. Это не тест нативной компиляции или реального вызова Matrix SDK.
- `node scripts/verify-matrix-binaries.cjs`: оба ARM ELF присутствуют, архитектуры соответствуют ABI.
- `npx expo-modules-autolinking react-native-config --platform android --json`: обнаружены ReactNativeMatrixSdkPackage и RNReactNativeMatrixSdkSpec, указан поставляемый CMakeLists.txt.
- `npx expo config --type introspect --json`: reactNativeArchitectures = arm64-v8a,armeabi-v7a.
- `npx expo export --platform android`: пройдено; 1272 модуля, создан Android Hermes bytecode. Первый запуск не смог запустить компилятор в песочнице (`spawn EPERM`); повтор с разрешением запуска завершился успешно. Это не APK.
- package.json и lockfile согласованы; Matrix зафиксирован на 0.10.2; конфликтов дерева Reanimated/Worklets/React DOM после исправления нет.
- npm сообщил 32 уязвимости (10 moderate, 22 high). Автоматические audit-исправления, включая `npm audit fix --force`, не запускались; аудит уязвимостей не закрыт этим этапом.

На этапе этих локальных проверок Gradle/CMake/Kotlin-компиляция ещё не была выполнена. Затем первая EAS-сборка успешно завершилась, а предоставленный пользователем скриншот с Tecno подтвердил успешные нативные вызовы: Rust SHA `1c44fb6`, результаты `true` / `false`, время `5146 мс` с загрузкой модуля. Подробный результат и готовый APK находятся в [ANDROID_BUILD_RESULT.md](./ANDROID_BUILD_RESULT.md). Вход в Matrix, сеть, sync и E2EE не проверялись и не входят в этот этап.

## Вход и сборка

В PowerShell в папке проекта:

```powershell
Set-Location 'C:\Users\qtas5\Documents\Codex\2026-10-02\new-chat\watcher-matrix-check'
npx eas-cli@latest login
```

В этой папке пока нет Git-репозитория. Чтобы собрать без его создания, задайте переменную только для текущей PowerShell-сессии:

```powershell
$env:EAS_NO_VCS = '1'
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile development
```

Проект уже привязан к `@cprophet/watcher-matrix-check`, настоящий `extra.eas.projectId` сохранён в app.json, Android keystore создан в Expo. Для будущих сборок повторный `init` не нужен. Google Play developer account для установки этого APK не требуется. Команда `build` запускает новую облачную сборку; готовый результат первой сборки доступен в ANDROID_BUILD_RESULT.md.

Не запускайте `eas build:configure` для замены профилей: development уже подготовлен. Если используете Git, вместо EAS_NO_VCS можно инициализировать репозиторий и сохранить исходники/lockfile; node_modules и сгенерированные native-папки должны оставаться исключёнными.

## Установка и запуск на телефоне

1. Дождитесь статуса Finished в EAS. Откройте ссылку/QR установки из результата сборки на Android-телефоне.
2. Скачайте APK и установите. При запросе Android разрешите установку из используемого браузера. Телефон должен поддерживать ARM ABI из профиля.
3. На компьютере запустите Metro:

```powershell
npx expo start --dev-client --clear
```

4. Подключите компьютер и телефон к одной Wi-Fi сети. Откройте установленное приложение `watcher-matrix-check`, затем отсканируйте QR Metro в development launcher или откройте URL проекта. Используйте этот APK, а не Expo Go.
5. Нажмите «Проверить SDK».

Ожидаемый результат:

- «Нативные вызовы выполнены»;
- непустой фактический Rust SDK SHA (это SHA Rust SDK, а не версия npm-обёртки);
- `#matrix-probe:example.org → true`;
- `not-a-room-alias → false`;
- время проверки в миллисекундах.

Псевдонимы проверяются локально; подключения к example.org или иному homeserver нет. Аккаунты, токены и пользовательские сообщения не используются. Полный чат, дневник и восстановление не реализованы.

При изменении native-зависимостей нужен новый APK. Для изменений экрана достаточно Metro reload.

Если телефон не соединяется с Metro, проверьте разрешение Windows Firewall для Node и доступность LAN. Альтернативный запуск: `npx expo start --dev-client --tunnel` (Expo может предложить установить поддержку туннеля).

При JS-ошибке экран покажет этап и исходный текст. Нативный crash может закрыть приложение до JS-обработчика. Если Android platform-tools уже установлены, подключите телефон по USB с USB debugging и сохраните лог:

```powershell
adb logcat -v time > matrix-device.log
```

Воспроизведите ошибку и остановите лог Ctrl+C. При ошибке компиляции сохраните первый содержательный Gradle/CMake/Kotlin error из EAS. Не считайте успешный импорт, Expo Go или прохождение doctor подтверждением работы Rust SDK.

## Источники

Следующий этап с проверкой сервера, входом и одним тестовым сообщением описан в [MATRIX_NETWORK_TEST.md](./MATRIX_NETWORK_TEST.md). Он использует установленный development APK; сетевой результат на телефоне пока не подтверждён.

- Expo 57: https://docs.expo.dev/versions/v57.0.0/
- Dev client: https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/
- APK/EAS: https://docs.expo.dev/build-reference/apk/
- EAS init/login: https://docs.expo.dev/tutorial/eas/configure-development-build/
- ABI config: https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/
- Matrix npm 0.10.2: https://www.npmjs.com/package/@unomed/react-native-matrix-sdk/v/0.10.2
- Исходники: https://github.com/unomed-dev/react-native-matrix-sdk/tree/fb1204910ac43de120955ea56a84a170db5d0ba1
