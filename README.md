# Registro de Notas - Ejecución Local 🚀

Este proyecto es una aplicación web de alto rendimiento y diseño editorial para el **Registro de Notas e Informes de Rendimiento Académico Individual**. Cuenta con integración de respaldos en la nube utilizando **Firebase Authentication** y **Google Drive API**.

Sigue estos sencillos pasos para instalar y ejecutar esta aplicación de manera 100% local en tu computadora.

---

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado en tu sistema:
- **Node.js** (versión `18.x`, `20.x` o superior recomendada)
- **npm** (instalado automáticamente junto con Node.js)

---

## ⚙️ Pasos para la Instalación y Uso Local

### 1. Descarga el Proyecto
Si descargaste el archivo ZIP desde AI Studio o clonaste el repositorio, abre una terminal en la carpeta raíz del proyecto.

### 2. Instala las Dependencias
Ejecuta el siguiente comando para instalar todos los paquetes y librerías necesarias de la aplicación:
```bash
npm install
```

### 3. Ejecuta el Servidor de Desarrollo
Hemos preparado un comando optimizado para la ejecución local. Inicia el servidor de desarrollo corriendo:
```bash
npm run dev:local
```
*(Este comando iniciará el servidor de desarrollo de **Vite** en un puerto local standard, usualmente `http://localhost:5173`).*

También puedes seguir usando el comando predeterminado si deseas forzar el puerto 3000:
```bash
npm run dev
```

---

## 🛠️ Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev:local` | Inicia el servidor de desarrollo local en el puerto predeterminado con soporte HMR automático (Hot Module Replacement). |
| `npm run dev` | Inicia el desarrollo local forzando el puerto `3000` en la interfaz de red `0.0.0.0`. |
| `npm run build` | Compila la aplicación para producción generando los activos estáticos minificados en la carpeta `/dist`. |
| `npm run preview` | Inicia un servidor local para previsualizar los archivos compilados de producción. |
| `npm run lint` | Valida el tipado de TypeScript en todo el proyecto para asegurar que no haya errores de compilación. |

---

## 📂 Estructura Principal del Proyecto

- `/src/App.tsx`: Componente principal y gestor de estado global de la aplicación.
- `/src/components/`: Sub-componentes modulares e individuales (vistas de estudiantes, reportes, configuración, etc.).
  - `/src/components/FichaView.tsx`: Diseño y lógica de la hoja de informe (visible y para impresión).
  - `/src/components/LowGradeReportDetails.tsx`: Sección de diagnóstico y ficha técnica de rendimiento.
- `/src/drive.ts`: Helper de integración para la conexión con la API de Google Drive para respaldar notas.
- `/firebase-applet-config.json`: Credenciales públicas y seguras de Firebase necesarias para la autenticación de Google. El archivo ya viene pre-configurado y listo para usar en tu localhost de desarrollo.

---

## 🔐 Google Drive y Firebase en Local

La aplicación utiliza un flujo seguro de autenticación por Google para guardar tus plantillas y registros de notas en una carpeta especial llamada **"Registro de Notas"** dentro de tu Google Drive personal.

**¿Qué pasa al ejecutar localmente?**
- Firebase Auth aceptará conexiones directas desde tu entorno de desarrollo local (`http://localhost:*`).
- Al presionar **"Iniciar Sesión con Google"** o **"Respaldar en Google Drive"**, se abrirá una ventana emergente de inicio de sesión estándar de Google para que conectes tu cuenta de forma completamente segura y directa con los servidores de Google.

---

## 🚨 Solución de Problemas (Linux Mint / Ubuntu / Debian)

### Error: `Cannot find native binding` (Relacionado con `@tailwindcss/oxide`)
Este error ocurre porque npm tiene un bug conocido en Linux al descargar dependencias opcionales compiladas (como el motor Rust de Tailwind v4), especialmente si el archivo `package-lock.json` fue creado en otro sistema operativo.

**La solución más rápida y directa en Linux Mint:**

Hemos creado un comando preconfigurado para forzar la instalación del binario nativo de Linux de forma inmediata. Ejecuta este comando en tu terminal:

```bash
npm run fix:linux
```

*(Esto instalará directamente el paquete `@tailwindcss/oxide-linux-x64-gnu` en tus dependencias y resolverá el conflicto al instante).*

Una vez que termine, puedes iniciar la aplicación de forma normal:
```bash
npm run dev:local
```

---

### Solución Alternativa (Si lo anterior no es suficiente):

Si el error persiste, limpia la instalación y reinstala desde cero con estos tres comandos:

1. **Limpia los archivos temporales:**
   ```bash
   rm -rf node_modules package-lock.json
   ```

2. **Fuerza la instalación del motor de Tailwind para tu plataforma:**
   ```bash
   npm install @tailwindcss/oxide-linux-x64-gnu --save-optional
   ```

3. **Instala el resto de dependencias de forma normal:**
   ```bash
   npm install
   ```

4. **Inicia la aplicación:**
   ```bash
   npm run dev:local
   ```

