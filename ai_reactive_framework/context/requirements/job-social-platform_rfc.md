# **Requisitos Funcionales \- JSP (Job Social Platform)**

## **1\. Introducción**

JSP (Job Social Platform) es una plataforma digital innovadora que combina las funcionalidades de una red social professional con un sistema inteligente de recomendación de empleos. La plataforma conecta a empresas reclutadoras con profesionales talentosos, facilitando el networking, la búsqueda de empleo y la gestión de oportunidades laborales en un entorno social colaborativo.

## **2\. Objetivos del Sistema**

* Facilitar la conexión entre profesionales y oportunidades laborales  
* Crear una red social professional dinámica e interactiva  
* Implementar un sistema de recomendaciones inteligente basado en matching de perfiles  
* Optimizar el proceso de reclutamiento para empresas  
* Promover el crecimiento professional y networking

## **3\. Requisitos Funcionales por Historia de Usuario**

### **HU-JSP01: Registro de Usuario Empresa-Empleado**

**Descripción**: Como visitante del sistema, quiero registrarme como empresa o professional para acceder a las funcionalidades de la plataforma según mi tipo de usuario.

#### **Criterios de Aceptación:**

**Selección de tipo de usuario**:

* El sistema debe presentar opciones claras para registrarse como "professional" o "Empresa"  
* Debe mostrar beneficios y características de cada tipo de cuenta  
* La interfaz debe ser intuitiva y responsive

**Registro para Profesionales**:

* Campos obligatorios: nombre, apellido, email, contraseña, país  
* Campos opcionales: teléfono, fecha de nacimiento, género  
* Validación de email único en el sistema  
* Contraseña debe cumplir políticas de seguridad (mínimo 8 caracteres, incluir mayúsculas, minúsculas, números)  
* Aceptación obligatoria de términos y condiciones de uso

**Registro para Empresas**:

* Campos obligatorios: razón social, NIT/RUC, email corporativo, contraseña, sector empresarial, país  
* Campos opcionales: teléfono, sitio web, número de empleados  
* Validación de NIT/RUC único en el sistema  
* Email debe ser corporativo (verificación de dominio empresarial)  
* Proceso de verificación empresarial posterior al registro

**Validaciones del sistema**:

* Email no registrado previamente  
* Formato válido de email  
* NIT/RUC válido según el país seleccionado  
* Contraseña segura según políticas establecidas  
* Campos obligatorios completados correctamente

**Proceso de verificación**:

* Envío automático de email de verificación  
* Link de confirmación con expiración de 24 horas  
* Reenvío de email de verificación si es necesario  
* Para empresas: proceso adicional de verificación manual

**Precondiciones**:

* Usuario no registrado previamente en el sistema  
* Conexión a internet estable  
* Email válido y accesible

**Postcondiciones**:

* Cuenta de usuario creada con estado "pendiente de verificación"  
* Email de confirmación enviado  
* Perfil básico iniciado según tipo de usuario  
* Registro en logs de auditoría

### **HU-JSP02: Login de Usuarios**

**Descripción**: Como usuario registrado, quiero iniciar sesión en la plataforma para acceder a mi cuenta y utilizar todas las funcionalidades disponibles según mi tipo de usuario.

#### **Criterios de Aceptación:**

**Autenticación básica**:

* Login mediante email y contraseña  
* Validación de credenciales en tiempo real  
* Verificación de estado de cuenta (activa, verificada)  
* Manejo de cuentas no verificadas con opción de reenvío de verificación

**Seguridad de acceso**:

* Bloqueo temporal de cuenta tras 5 intentos fallidos (15 minutos)  
* Registro de intentos de acceso en logs de seguridad  
* Notificación por email en caso de intentos sospechosos  
* Detección de accesos desde ubicaciones inusuales

**Funcionalidades adicionales**:

* Opción "Recordar sesión" para mantener login activo (30 días máximo)  
* Funcionalidad "Olvidé mi contraseña" con envío de link de recuperación  
* Login social opcional (Google, LinkedIn)  
* Autenticación de dos factores (2FA) opcional

**Gestión de sesiones**:

* Generación de token JWT con tiempo de vida configurable  
* Renovación automática de tokens antes del vencimiento  
* Logout automático por inactividad (2 horas)  
* Logout manual con invalidación de token

**Redirección post-login**:

* Dashboard personalizado según tipo de usuario  
* Redirección a página solicitada originalmente  
* Onboarding para usuarios nuevos no completado

**Precondiciones**:

* Usuario registrado y verificado  
* Credenciales válidas  
* Cuenta no bloqueada o suspendida

**Postcondiciones**:

* Sesión activa iniciada  
* Token de autenticación generado  
* Acceso a funcionalidades según tipo de usuario  
* Actualización de fecha de último acceso

### **HU-JSP03: Registro de Historias Laborales**

**Descripción**: Como professional, quiero registrar y gestionar mi información professional completa (perfil personal, formación académica, experiencia laboral) para que las empresas puedan conocer mi trayectoria y competencias.

#### **Criterios de Aceptación:**

**Perfil Personal**:

* Foto de perfil professional (JPG, PNG, máximo 5MB, redimensionamiento automático)  
* Información básica: título professional, ubicación actual, disponibilidad laboral  
* Resumen professional (máximo 500 caracteres)  
* Links profesionales: LinkedIn, portfolio web, GitHub, otros  
* Configuración de privacidad del perfil (público, solo conexiones, privado)  
* Información de contacto adicional con opciones de visibilidad

**Formación Académica**:

* Múltiples registros educativos permitidos  
* Campos obligatorios: institución, título/carrera, nivel educativo, fechas de inicio y fin  
* Campos opcionales: promedio académico, descripción, certificados  
* Estados: completado, en curso, pausado, abandonado  
* Carga de certificados/diplomas (PDF, JPG, PNG, máximo 10MB cada uno)  
* Validación de fechas coherentes  
* Ordenamiento cronológico automático

**Experiencia Laboral**:

* Múltiples registros de experiencia permitidos  
* Campos obligatorios: empresa, cargo, fechas de inicio y fin, descripción de funciones  
* Campos opcionales: logros, tecnologías utilizadas, referencias  
* Opción para marcar experiencia actual (sin fecha fin)  
* Cálculo automático de tiempo total de experiencia  
* Niveles de experiencia: Junior (0-2 años), Semi-Senior (2-5 años), Senior (5-8 años), Lead (8+ años)  
* Validación de fechas y coherencia temporal  
* Posibilidad de adjuntar documentos de respaldo

**Habilidades y Competencias**:

* Categorización: técnicas, blandas, idiomas, certificaciones  
* Niveles de dominio: básico, intermedio, avanzado, experto  
* Sistema de endorsement por parte de conexiones  
* Certificaciones con fechas de vencimiento  
* Habilidades sugeridas basadas en el perfil  
* Verificación de habilidades mediante pruebas (opcional)

**Gestión y Validación**:

* Vista previa del perfil como lo ven las empresas  
* Indicador de completitud del perfil con sugerencias de mejora  
* Sistema de versioning para cambios importantes  
* Exportación del perfil en formato PDF  
* Backup automático de información

**Precondiciones**:

* Usuario professional con sesión activa  
* Perfil básico creado durante el registro

**Postcondiciones**:

* Información professional almacenada y indexada  
* Perfil visible según configuración de privacidad  
* Cálculo de métricas de perfil actualizado  
* Habilitación del sistema de recomendaciones

### **HU-JSP04: Crear Convocatoria de Trabajo**

**Descripción**: Como empresa, quiero crear y publicar convocatorias de empleo detalladas para atraer candidatos calificados que se ajusten a mis necesidades organizacionales.

#### **Criterios de Aceptación:**

**Información Básica de la Convocatoria**:

* Título del puesto (obligatorio, máximo 100 caracteres)  
* Departamento o área de la empresa  
* Ubicación específica (ciudad, país) o "remoto"  
* Modalidad de trabajo: presencial, remoto, híbrido  
* Tipo de contrato: tiempo completo, medio tiempo, temporal, freelance  
* Nivel jerárquico: junior, semi-senior, senior, lead, director

**Descripción Detallada**:

* Descripción del puesto (obligatorio, máximo 2000 caracteres)  
* Responsabilidades principales  
* Requisitos técnicos y de experiencia  
* Requisitos educativos mínimos  
* Habilidades deseadas vs obligatorias  
* Beneficios y compensaciones adicionales

**Compensación**:

* Rango salarial (mínimo y máximo)  
* Moneda y periodicidad (mensual, anual)  
* Beneficios adicionales: seguros, bonos, días libres, capacitación  
* Opción de ocultar salario públicamente  
* Indicadores de compensación competitiva

**Configuración de la Convocatoria**:

* Fecha de cierre de postulaciones  
* Número máximo de postulaciones (opcional)  
* Requiere carta de presentación (sí/no)  
* Requiere portfolio o trabajos previos  
* Preguntas personalizadas para candidatos  
* Configuración de privacidad (pública, solo conexiones)

**Proceso de Publicación**:

* Vista previa completa antes de publicar  
* Opción de guardar como borrador  
* Programación de publicación para fecha específica  
* Duplicación de convocatorias similares  
* Plantillas predefinidas por industria

**Gestión Post-Publicación**:

* Edición limitada de convocatorias activas  
* Estadísticas de visualizaciones e interacciones  
* Panel de gestión de postulaciones  
* Opciones de promoción y destacado  
* Cierre anticipado o extensión de plazo

**Precondiciones**:

* Usuario empresa con sesión activa  
* Perfil de empresa completado al menos 70%  
* Plan de suscripción con convocatorias disponibles

**Postcondiciones**:

* Convocatoria publicada y visible en la plataforma  
* Indexación para sistema de búsqueda y recomendaciones  
* Notificaciones enviadas a profesionales relevantes  
* Métricas de rendimiento iniciadas

### **HU-JSP05: Recomendar Ofertas de Trabajo**

**Descripción**: Como professional, quiero recibir recomendaciones personalizadas e inteligentes de ofertas de trabajo que se ajusten a mi perfil, experiencia y preferencias profesionales.

#### **Criterios de Aceptación:**

**Motor de Recomendaciones Inteligente**:

* Análisis del perfil completo: habilidades, experiencia, formación  
* Matching basado en ubicación y preferencias de modalidad  
* Consideración de nivel salarial esperado vs ofrecido  
* Análisis de trayectoria professional y crecimiento  
* Machine learning para mejorar recomendaciones con el tiempo

**Criterios de Matching**:

* Compatibilidad de habilidades técnicas (peso: 40%)  
* Experiencia relevante en el sector (peso: 30%)  
* Ubicación y modalidad de trabajo (peso: 15%)  
* Nivel salarial y beneficios (peso: 10%)  
* Cultura empresarial y valores (peso: 5%)

**Sistema de Puntuación**:

* Porcentaje de compatibilidad por cada oferta (0-100%)  
* Explicación detallada de por qué se recomienda cada oferta  
* Identificación de gaps en el perfil con sugerencias de mejora  
* Comparación con perfiles similares exitosos

**Personalización y Filtros**:

* Configuración de preferencias de búsqueda  
* Filtros por: salario mínimo, ubicación, modalidad, tipo de contrato  
* Exclusión de sectores o empresas específicas  
* Preferencias de tamaño de empresa (startup, PYME, corporación)  
* Alertas personalizadas para nuevas ofertas relevantes

**Presentación de Recomendaciones**:

* Dashboard con ofertas ordenadas por relevancia  
* Vista detallada con análisis de compatibilidad  
* Historial de recomendaciones anteriores  
* Ofertas guardadas para revisión posterior  
* Comparación side-by-side de ofertas

**Feedback y Mejora Continua**:

* Sistema de feedback: "me interesa", "no me interesa", "ya aplicé"  
* Razones de descarte para mejorar futuras recomendaciones  
* Seguimiento de aplicaciones exitosas  
* Aprendizaje automático basado en comportamiento del usuario

**Notificaciones**:

* Notificaciones push para nuevas ofertas altamente compatibles  
* Resumen semanal de oportunidades  
* Alertas por email configurables  
* Notificaciones de cambios en ofertas guardadas

**Precondiciones**:

* Usuario professional con sesión activa  
* Perfil completado al menos 60%  
* Preferencias de búsqueda configuradas  
* Historial de interacciones para personalización

**Postcondiciones**:

* Lista de recomendaciones personalizada generada  
* Métricas de interacción registradas  
* Perfil de preferencias actualizado  
* Datos para mejora del algoritmo recolectados

### **HU-JSP06: Ofertar a Convocatoria de Trabajo**

**Descripción**: Como professional, quiero postularme a convocatorias de trabajo de manera eficiente y professional, gestionando mis aplicaciones y dando seguimiento a su estado.

#### **Criterios de Aceptación:**

**Proceso de Postulación**:

* Vista completa de la convocatoria antes de aplicar  
* Verificación de elegibilidad automática basada en requisitos  
* Formulario de aplicación pre-rellenado con datos del perfil  
* Posibilidad de personalizar información específica para cada aplicación  
* Preview de la aplicación antes del envío final

**Documentación Requerida**:

* CV actualizado (generado automáticamente desde el perfil o cargado manualmente)  
* Carta de presentación (opcional o requerida según convocatoria)  
* Portfolio o trabajos previos si se solicita  
* Respuestas a preguntas personalizadas de la empresa  
* Documentos adicionales según especificaciones

**Gestión de Aplicaciones**:

* Dashboard centralizado de todas las postulaciones  
* Estados de seguimiento: enviada, en revisión, preseleccionado, entrevista programada, rechazada, contratado  
* Historial completo de comunicaciones  
* Posibilidad de retirar aplicación antes del cierre  
* Recordatorios y alertas de seguimiento

**Prevención de Duplicados**:

* Detección automática de aplicaciones duplicadas  
* Advertencia antes de aplicar a ofertas similares en la misma empresa  
* Límite de aplicaciones diarias para evitar spam  
* Bloqueo temporal por aplicaciones masivas indiscriminadas

**Comunicación y Seguimiento**:

* Mensajería integrada con reclutadores  
* Notificaciones de cambios de estado  
* Programación de entrevistas desde la plataforma  
* Feedback post-entrevista (cuando esté disponible)  
* Rating y review del proceso de selección

**Analytics Personal**:

* Estadísticas de aplicaciones: enviadas, respuestas, tasa de éxito  
* Análisis de tiempo de respuesta promedio por empresa/sector  
* Identificación de patrones en aplicaciones exitosas  
* Sugerencias de mejora basadas en performance

**Precondiciones**:

* Usuario professional con sesión activa  
* Perfil completado adecuadamente  
* Convocatoria activa y dentro del plazo  
* No haber aplicado previamente a la misma convocatoria

**Postcondiciones**:

* Aplicación registrada en el sistema  
* Notificación enviada a la empresa  
* Estado de seguimiento iniciado  
* Métricas de usuario actualizadas

### **HU-JSP07: Crear Publicación**

**Descripción**: Como usuario (professional o empresa), quiero crear y compartir contenido professional en la plataforma para construir mi marca personal/corporativa, generar networking y aportar valor a la comunidad.

#### **Criterios de Aceptación:**

**Tipos de Contenido**:

* Publicaciones de texto con formato enriquecido (negrita, cursiva, enlaces)  
* Publicaciones con imágenes (JPG, PNG, GIF, máximo 10MB, hasta 10 imágenes)  
* Compartir logros profesionales y certificaciones  
* Publicar artículos largos (modo blog integrado)  
* Compartir vacantes y oportunidades laborales  
* Celebrar logros del equipo y empresa

**Herramientas de Edición**:

* Editor WYSIWYG con opciones de formato  
* Inserción de enlaces con preview automático  
* Herramientas de recorte y edición básica de imágenes  
* Inserción de emojis profesionales  
* Templates prediseñados para diferentes tipos de posts  
* Contador de caracteres y preview del post

**Configuración de Audiencia**:

* Niveles de privacidad: público, solo conexiones, grupos específicos  
* Targeting por industria, ubicación, nivel de experiencia  
* Opciones de comentarios: permitir todos, solo conexiones, desactivar  
* Configuración de notificaciones para interacciones

**Programación y Gestión**:

* Programación de publicaciones para fecha y hora específica  
* Borradores guardados automáticamente  
* Edición de posts publicados (con indicador de edición)  
* Eliminación de publicaciones propias  
* Análisis de alcance e interacciones

**Interacciones Sociales**:

* Sistema de likes y reacciones  
* Comentarios anidados con niveles de respuesta  
* Compartir posts de otros usuarios (repost)  
* Marcar posts como favoritos para referencia futura  
* Reportar contenido inapropiado

**Hashtags y Descubrimiento**:

* Sistema de hashtags para categorización  
* Hashtags trending por industria  
* Sugerencias automáticas de hashtags relevantes  
* Búsqueda avanzada por hashtags y contenido  
* Seguimiento de hashtags de interés

**Menciones y Networking**:

* Mención a otros usuarios (@username)  
* Notificaciones automáticas para usuarios mencionados  
* Posibilidad de etiquetar empresas y marcas  
* Conexiones sugeridas basadas en interacciones

**Moderación y Calidad**:

* Filtros automáticos para contenido inapropiado  
* Sistema de reportes de la comunidad  
* Moderación manual para contenido sensible  
* Políticas claras de contenido professional  
* Penalizaciones por spam o contenido no professional

**Analytics de Contenido**:

* Métricas de alcance e impresiones  
* Análisis de engagement por tipo de contenido  
* Mejor horario para publicar según audiencia  
* Demographics de la audiencia alcanzada  
* Comparación con posts anteriores

**Precondiciones**:

* Usuario con sesión activa  
* Perfil básico completado  
* Cumplimiento de políticas de contenido  
* No estar en estado de restricción por spam

**Postcondiciones**:

* Contenido publicado según configuración de privacidad  
* Indexación para búsqueda interna  
* Notificaciones enviadas a usuarios relevantes  
* Métricas de engagement iniciadas

## **4\. Requisitos No Funcionales Generales**

### **Seguridad**

* Autenticación JWT con refresh tokens  
* Encriptación AES-256 para datos sensibles  
* Protocolo HTTPS obligatorio en toda la plataforma  
* Auditoría completa de acciones críticas  
* Cumplimiento con GDPR y CCPA

### **Performance**

* Tiempo de carga inicial \< 3 segundos  
* Tiempo de respuesta API \< 500ms (95% de requests)  
* Soporte para 10,000 usuarios concurrentes  
* CDN para entrega optimizada de contenido estático  
* Caching inteligente en múltiples niveles

### **Usabilidad**

* Diseño responsive para móvil, tablet y desktop  
* Interfaz intuitiva con máximo 3 clics para funciones principales  
* Accesibilidad WCAG 2.1 nivel AA  
* Soporte multiidioma (español, inglés, portugués)  
* Onboarding guiado para nuevos usuarios

### **Disponibilidad**

* SLA de 99.9% de uptime  
* Backup automático cada 6 horas  
* Recuperación ante desastres RTO \< 4 horas  
* Monitoreo 24/7 con alertas automáticas  
* Escalabilidad automática basada en demanda

## **5\. Integraciones y APIs Externas**

### **Servicios Requeridos**

* Servicio de email transaccional (SendGrid, AWS SES)  
* Almacenamiento en la nube (AWS S3, Google Cloud Storage)  
* Servicio de geolocalización (Google Maps API)  
* Procesamiento de imágenes (Cloudinary, ImageKit)  
* Analytics y métricas (Google Analytics, Mixpanel)

### **APIs de Terceros**

* LinkedIn API para importación de perfiles  
* Google OAuth para autenticación social  
* Servicios de verificación de identidad empresarial  
* APIs de job boards para importación de vacantes  
* Servicios de análisis de sentimientos para contenido

## **6\. Consideraciones de Implementación**

### **Arquitectura Sugerida**

* Microservicios con API Gateway  
* Base de datos relacional (PostgreSQL) \+ NoSQL (MongoDB) para contenido  
* Message queue para procesamiento asíncrono (Redis, RabbitMQ)  
* Search engine para búsquedas complejas (Elasticsearch)  
* Cache distribuido (Redis) para performance

### **Metodología de Desarrollo**

* Desarrollo ágil con sprints de 1 semanas  
* CI/CD automatizado con testing completo  
* Code review obligatorio para todas las features  
* Testing automatizado (unitario, integración, E2E)  
* Documentación técnica actualizada automáticamente

### **Métricas de Éxito**

* Tasa de registro y activación de usuarios  
* Tiempo de completitud de perfiles  
* Matching rate entre ofertas y candidatos  
* Engagement rate en contenido social  
* Net Promoter Score (NPS) de la plataforma

