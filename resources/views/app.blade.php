<!DOCTYPE html>
<html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
        <title>NÉXUS — Holocron de combate</title>

        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#04070f">

        {{-- iOS: instalación como app + ícono de pantalla de inicio --}}
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="NÉXUS">
        <link rel="apple-touch-icon" href="/assets/pwa/icon-192.png">
        <link rel="icon" href="/assets/pwa/icon-192.png">

        @viteReactRefresh
        @vite(['resources/js/app.jsx'])
    </head>
    <body style="margin:0;background:#04070f;">
        <div id="root"></div>
    </body>
</html>
