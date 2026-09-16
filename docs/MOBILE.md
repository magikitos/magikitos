# Apps iOS / Android y publicación

## Estado real de esta entrega

Se han generado y sincronizado los proyectos nativos de **Capacitor 8.5.2**,
con un único motor compartido y seis idiomas empaquetados. No se carga el juego
remotamente mediante `server.url` ni se incluye backend PHP en la aplicación.
PHP solo se utiliza durante el build del catálogo de mundo.

Capacitor 9 está en desarrollo; no se fija una alpha para esta primera base.
La integración específica de plataforma queda en `apps/mobile/src/platform.js`
y en las configuraciones nativas, para que la actualización posterior no
requiera reescribir el juego. Véase la
[hoja de ruta oficial de Capacitor 9](https://ionic.io/blog/the-road-to-capacitor-9).

**No hay una compilación nativa verificada todavía.** El empaquetado web y
`cap sync` iOS/Android sí se han ejecutado. En este Mac, Xcode 26.6 resolvió los
paquetes Swift, pero rechazó la compilación al faltar su plataforma iOS 26.5.
Su instalador pidió **8,49 GB** libres y había menos de **400 MB**. No se han
borrado archivos personales para conseguir espacio. Tampoco hay Java instalado.
Los logs locales están en `.local/ios-build.log` y
`.local/ios-platform-download.log`.

No se han creado certificados, fichas de tienda, claves, ejecuciones de CI,
TestFlight ni releases Play. Los iconos de launcher son aún los del scaffold:
**hay que sustituirlos por el branding aprobado antes de enviar una beta**.
El lanzamiento iOS ya usa fondo verde liso, no el logo de ejemplo.

## Estructura

```text
public/, data/                  único juego y sus recursos
tools/build-mobile.cjs          verifica artefacto y empaqueta seis entradas
apps/mobile/
  package.json, package-lock.json  dependencias nativas aisladas
  capacitor.config.json        identidad/configuración de plataformas
  src/                         inicio de idioma y adaptador nativo
  www/                         salida generada, NO se versiona
  ios/                         proyecto Xcode + scheme compartido App
  android/                     proyecto Gradle + wrapper
.github/workflows/mobile-android.yml  compilación manual y beta interna opcional
```

Identificador previsto: `com.magikitos.adventure`. Confirmar su disponibilidad y
titularidad antes de registrar la primera app. No se reutilizan identificadores,
certificados ni secretos de Roadbook. Cambiarlo después de publicar supone otra
app, por lo que debe decidirse antes de la primera subida.

## Preparar y abrir en local

Desde la raíz de `magikitos-game`, con Node 22 y PHP:

```sh
npm ci
npm --prefix apps/mobile ci
npm run mobile:sync
npm run test:mobile:package
npm run mobile:ios
# O, con Android Studio / Java 21 / SDK 36 instalados:
npm run mobile:android
```

`mobile:sync` genera `www` desde el artefacto verificado y actualiza ambas
plataformas. No despliega nada. Repetirlo tras cambiar el juego antes de compilar.
Los MP3 ya preparados se empaquetan; CI no necesita ffmpeg ni los masters.
La app actual lleva unos 24 MB de recursos web, no todos decodificados al abrir.
En navegador, la música se transmite por streaming; dentro de la app esos mismos
ficheros se leen del bundle. El mundo compartido y los contenidos publicados
siguen requiriendo API/conexión: offline no significa multijugador offline.

`MOBILE_WEBSITE_ORIGIN=https://host-de-pruebas.example` permite seleccionar otro
backend HTTPS al empaquetar. Nunca poner claves en esa variable. Por defecto
apunta al contrato público de `https://magikitos.com/api/world/`.

## Integración API: requisito antes de la beta conectada

La web y el backend siguen en su repo privado, sin copiarlos a esta app.
El backend ya tiene allowlist explícita `WORLD_API_ALLOWED_ORIGINS` y admite
`Authorization`. La app no añade excepciones CORS, no elimina CSRF ni salta la
validación de identidad, materiales, permisos o prueba humana.

Antes de probar guardados compartidos en nativo, el responsable de la API debe:

1. Autorizar exactamente `capacitor://localhost` (iOS) y `https://localhost`
   (Android), manteniendo los orígenes ya autorizados. Nada de wildcard con
   credenciales. Los orígenes reales deben comprobarse en dispositivo.
2. Verificar creación de sesión anónima desde esos orígenes, bearer y renovación,
   así como los endpoints protegidos por comprobación humana.
3. Definir y probar el intercambio seguro de sesión al iniciar sesión en la web
   desde la app. Abrir el navegador del sistema **no comparte automáticamente**
   su cookie/localStorage con la WebView. No se ha inventado un nuevo endpoint
   de autenticación ni se guardan claves de backend en el cliente.
4. Para tokens de larga duración en nativo, cerrar el diseño de almacenamiento
   seguro Keychain/Keystore y revocación antes de publicación general. La base
   actual conserva el mecanismo de sesión web existente.

La prueba `test:mobile:package` confirma que el bundle abre sin red, carga recursos
locales, conserva idioma y mantiene la API remota separada. **No demuestra** que
el login nativo o una partida cloud real ya funcionen. No se ha cambiado la
configuración de producción de la API en esta entrega.

## iOS: del Mac a TestFlight

1. Liberar espacio suficiente para plataforma y compilaciones (con margen,
   no solamente los 8,49 GB de descarga). En Xcode → Settings → Components,
   instalar la plataforma iOS requerida. Instalar simulador si se va a usar.
2. Ejecutar `npm run mobile:sync`, abrir `npm run mobile:ios`. Seleccionar target
   **App**, scheme **App**, el equipo Apple Developer propio y firma automática.
3. Probar en un iPhone y un iPad reales: entrada, audio, fullscreen nativo,
   safe areas, ambas orientaciones, segundo plano, auriculares y API.
4. Registrar el Bundle ID y crear la app correspondiente en App Store Connect.
   Configurar nombre, categoría, privacidad, clasificación por edades y derechos
   de contenido/música. Sustituir iconos de scaffold y preparar capturas.
5. `apps/mobile/package.json` expresa la versión pública inicial `0.1.0`.
   En Xcode, General → Identity, mantener Version coherente y aumentar **Build**
   para cada subida. No reutilizar números de build ya enviados.
6. Elegir **Any iOS Device (arm64)** → Product → Archive. En Organizer:
   Validate App → Distribute App → App Store Connect → Upload.
7. Tras procesarse, App Store Connect → TestFlight: completar información de
   prueba/exportación y asignar a un grupo interno. La beta externa requiere
   el proceso de Beta App Review. Esto no publica automáticamente en App Store.

Referencia: [TestFlight de Apple](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

### iOS por Xcode Cloud

Conectar este repo a App Store Connect/Xcode Cloud usando la cuenta del dueño y
el scheme compartido `apps/mobile/ios/App/App.xcodeproj` → **App**.
Crear primero un workflow manual con Archive y distribución **TestFlight interna**.
No activar publicación general ni builds automáticos de todos los pushes.

Los hooks junto al proyecto, en `apps/mobile/ios/App/ci_scripts/`, instalan Node
22/PHP, ejecutan ambos `npm ci`, empaquetan y sincronizan. El hook pre-build fija
Version desde `apps/mobile/package.json` y Build desde `CI_BUILD_NUMBER`.
Revisar que el contador de Cloud sea mayor que cualquier subida local anterior.
Apple gestiona la firma una vez configurado el equipo, app y permisos.

La configuración externa de este workflow **no está creada ni comprobada**.
[Guía de Xcode Cloud](https://developer.apple.com/documentation/xcode/configuring-your-first-xcode-cloud-workflow).

## Android: compilación cloud y Play

El workflow manual **Android — build or internal test** usa Ubuntu, Node 22,
Java 21, SDK 36, los lockfiles y el Gradle wrapper del repo. No necesita Java en
este Mac. El scaffold y el workflow ya están versionados en GitHub; el workflow
no se ha ejecutado ni se han configurado sus credenciales. La publicación web
posterior no incluye entrega nativa a tiendas.

1. Crear en GitHub el environment **mobile-internal**, con revisores requeridos
   antes de guardar credenciales. Ejecutar una compilación sin firma para
   comprobar la infraestructura. Su AAB es un artefacto de diagnóstico, no una
   aplicación lista para instalar o subir a Play.
2. Crear la app en Play Console para `com.magikitos.adventure`, completar sus
   formularios y configurar Play App Signing. Generar una **upload key dedicada
   a Magikitos** y custodiar copia/contraseñas fuera del repo.
3. Añadir secretos al environment:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD`. `signed=true` genera el AAB firmado descargable.
4. La primera subida se hace manualmente en Play Console → Testing → Internal
   testing, con ese AAB. Completar configuración pendiente y grupo de testers.
5. Para futuras subidas automáticas, habilitar Android Publisher API y crear una
   cuenta de servicio autorizada **solo para esta app y sus pruebas**, sin roles
   de propietario del proyecto. Guardar su JSON en `PLAY_SERVICE_ACCOUNT_JSON`.
6. Lanzar el workflow con `build_number` entero único y creciente,
   `signed=true`, `publish_internal=true`. Sube a la pista **internal** en estado
   **draft**; finalizar/revisar la entrega en Console. No toca producción.

Documentación:
[Android Publisher y permisos](https://developers.google.com/android-publisher/getting_started),
[acción de subida y primera entrega manual](https://github.com/r0adkll/upload-google-play).

## Lista de salida pendiente (no ocultar)

- Compilación y pruebas nativas reales de ambas plataformas.
- Allowlist/API, autenticación nativa y guardado cloud comprobados.
- Iconos finales, capturas, fichas de tienda, privacidad y derechos musicales.
- Equipo/firma Apple, upload key Android y secrets con alcance mínimo.
- Revisar requisitos de las tiendas vigentes cuando se envíe la app.
- Escuchar los audios y probar interrupciones en Safari y WebViews reales;
  las simulaciones de ciclo de vida de Chrome no equivalen al SO.

El código web puede seguir evolucionando y desplegándose independientemente.
Las apps reciben el juego empaquetado en sus releases revisadas, no una WebView
remota que cambie de motor a espaldas de la revisión de tienda.
