# `dev-blog` — Proyecto Independiente de Dev Blog (Astro + `cms-core-api`)

Plataforma editorial dedicada exclusivamente al **Dev Blog** de **Diego Cortés Hernandez**, separada de la Landing Page profesional y conectada directamente al servicio **`cms-core-api`**.

## 🚀 Comandos Rápidos

Desde la raíz (`IDEAS`):

```bash
# Levantar el Dev Blog en http://localhost:4322
npm run blog:dev

# Compilar el Dev Blog estático leyendo las publicaciones del CMS
npm run blog:build

# Previsualizar el build estático
npm run blog:preview
```

## 🔗 Mapa de Puertos del Ecosistema

| Proyecto | Propósito | Puerto Local |
|---|---|---|
| **Landing Page (`/` en raíz)** | Portafolio profesional, CV digital, Three.js Prism y contacto (`LANDING_CV`) | `http://localhost:4321` |
| **Dev Blog (`/dev-blog`)** | Plataforma editorial de artículos técnicos, tutoriales y pensamientos (`DEV_BLOG`) | `http://localhost:4322` |
| **CMS (`cms-core-api` en `/cms`)** | Orquestador editorial, 14 endpoints, WebSocket Live Preview y Consola Web | `http://127.0.0.1:4000/admin` |
