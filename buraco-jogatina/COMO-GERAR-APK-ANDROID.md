# Como gerar o APK Android do Buraco Jogatina

O jogo é empacotado como app Android com **Capacitor**: o build web roda dentro de um WebView nativo. O jogo contra a IA funciona 100% offline, e o app também pode **hospedar partidas online** (servidor WebSocket embutido, `HostServerPlugin`) para outros aparelhos na mesma rede Wi-Fi. O app é travado em paisagem.

## Pré-requisitos

- Android Studio instalado (traz o JDK e o Android SDK).
- Node.js e `npm install` feitos na raiz do projeto.

## Gerar o APK

Na raiz do projeto (a pasta onde está o `package.json`):

```bash
npm run android:apk
```

Isso roda o build web, sincroniza com `android/` e executa `./gradlew assembleDebug`. Se o Gradle reclamar do Java, aponte para o JDK do Android Studio (macOS):

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

Para abrir o projeto no Android Studio: `npm run android:sync` e depois `npm run android:open` (menu **Build → Build APK(s)**).

## Instalar

- Com cabo USB e depuração USB ativa: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- Ou copie o `.apk` para o celular e abra-o (permitindo instalar de fontes desconhecidas).

## Testar no emulador

```bash
$ANDROID_HOME/emulator/emulator -avd NOME_DO_AVD
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.buraco.jogatina/.MainActivity
```

## Versão

Aumente `versionCode` e `versionName` em `android/app/build.gradle` a cada APK novo, para o Android aceitar a atualização por cima.

## Observações

- **Online com servidor no PC**: `npm run server` (porta 3001). No navegador, abra `http://IP-DO-PC:3001`; quem cria a sala vê o código, o link e o QR para os outros entrarem.
- **Online hospedado pelo celular**: o aparelho que cria a sala vira o servidor; os outros entram por código, link ou QR (o app pede permissão de câmera para ler o QR).
- O `AndroidManifest.xml` permite tráfego em texto claro (`usesCleartextTraffic`) porque o servidor da sala é um endereço de rede local, sem HTTPS.
- Para publicar na Play Store é preciso um **AAB assinado** (`./gradlew bundleRelease` + keystore) e conta de desenvolvedor Google.
- Depois de mudar o jogo, rode `npm run android:sync` antes de gerar o APK de novo.
