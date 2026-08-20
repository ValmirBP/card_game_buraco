# Como gerar o APK Android do Buraco Jogatina

O jogo foi empacotado como app Android nativo usando **Capacitor** — ele roda o
build web dentro de um WebView nativo, e o **single-player funciona 100% offline**
dentro do app. O projeto nativo já está pronto na pasta `android/`.

> ⚠️ Para **gerar o .apk** você precisa do **Android Studio** instalado na sua
> máquina (ele já traz o JDK e o Android SDK). Esta etapa não pôde ser feita no
> ambiente onde o projeto foi montado porque lá não havia Java/SDK.

## 1. Instalar o Android Studio (uma vez)
- Baixe em https://developer.android.com/studio e instale.
- Ao abrir pela primeira vez, deixe ele instalar o **Android SDK** (padrão).

## 2. Gerar o APK

### Opção A — pelo Android Studio (mais fácil)
```bash
cd ".worktrees/buraco-impl"
npm run android:sync     # builda o jogo e copia pro projeto Android
npm run android:open     # abre o projeto no Android Studio
```
No Android Studio: menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
Ao terminar, clique em **locate** — o arquivo fica em:
`android/app/build/outputs/apk/debug/app-debug.apk`

### Opção B — por linha de comando (depois do Android Studio instalado)
```bash
cd ".worktrees/buraco-impl"
# Aponte para o JDK do Android Studio (exemplo no macOS):
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
npm run android:apk
```
O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`.

## 3. Instalar no celular
- **Via cabo USB** (com depuração USB ativada no celular):
  `adb install android/app/build/outputs/apk/debug/app-debug.apk`
- **Ou** copie o `app-debug.apk` para o celular e abra-o (permita "instalar de
  fontes desconhecidas").

## Observações
- **Single-player (contra IA): offline, tudo dentro do app.**
- **Multiplayer online:** o app precisa alcançar o servidor da sala. Hoje o modo
  online conecta no mesmo endereço de onde a página foi aberta; dentro do APK isso
  é o app local, então o online **ainda não funciona no APK** sem apontar para o
  IP do servidor. Fica como próximo passo (adicionar um campo "endereço do
  servidor" no modo online do app). No navegador (via `npm run start` na porta
  3001) o online continua funcionando normalmente.
- Para **publicar na Play Store**, é preciso gerar um **AAB assinado**
  (`./gradlew bundleRelease` + keystore) e uma conta de desenvolvedor Google —
  posso te guiar nisso quando quiser.
- Sempre que mudar o jogo, rode `npm run android:sync` antes de rebuildar o APK.
