# Registro de Notas - Ejecución Local 🚀

Este proyecto es una aplicación de alto rendimiento y diseño editorial para el **Registro de Notas e Informes de Rendimiento Académico Individual**. Funciona de manera 100% local, autónoma y privada, protegiendo todos tus datos en el almacenamiento interno de tu navegador sin necesidad de bases de datos externas ni servidores.

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
  - `/src/components/BackupView.tsx`: Gestión offline de importación y exportación de archivos.

---

## 💾 Respaldo y Manejo de Datos 100% Offline

Dado que la aplicación funciona localmente, la seguridad de tu información académica es prioritaria y no requiere de conexiones externas ni internet:

### 1. Respaldo Completo en un Clic (.JSON)
Puedes exportar toda la base de datos de calificaciones (alumnos, promedios, ponderaciones, etc.) a un único archivo `.json`.
* **Exportar**: Descarga una copia exacta a tu disco local.
* **Importar**: Permite restaurar toda tu información al instante en cualquier navegador o computadora seleccionando el archivo.

### 2. Plantillas de Evaluación en Excel (.XLSX)
La aplicación cuenta con integraciones locales de hojas de cálculo:
* Puedes exportar las planillas de notas a formato `.xlsx` de Excel con todas las ponderaciones de actividades ya formuladas.
* Puedes calificar o editar nombres sin conexión a internet y posteriormente volver a cargar el archivo a la aplicación para actualizar la base de datos automáticamente.

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

