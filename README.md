# Entregas de prácticos · Química Analítica I (Tecnólogo Químico, LATU)

Web app para que los alumnos **entreguen las planillas de los prácticos** desde el celular y para que el docente las **corrija**
(con el motor de corrección de AnaliticAPP), **anule** veredictos a mano, vea **tendencias** de errores y **exporte** a Excel.

- Frontend: React + Vite + TypeScript + Tailwind, publicado en **GitHub Pages**.
- Backend: **Supabase** (plan gratis): usuarios (Auth) + base Postgres con **Row Level Security (RLS)**.
- Motor de corrección: TypeScript puro en `src/chem/practicos/` (copiado de AnaliticAPP, commit `812dc08`).

> Estado: **etapa 1** (proyecto, Supabase, login y roles). Las demás etapas se van agregando con un Pull Request cada una.

---

## Cómo funciona

### Ingreso con cédula
- Se entra con **cédula uruguaya** (se valida el dígito verificador) y **contraseña**.
- Por dentro Supabase usa un mail ficticio `<cedula>@entregas.local`. Nadie ve ni usa ese mail.
- **Solo pueden crear cuenta las cédulas que están en el padrón** del curso. La primera vez, el alumno toca
  **“Primera vez”**, pone su cédula, la app comprueba que esté en el padrón y crea su contraseña (mínimo 8 caracteres).
  Si la cédula no está en el padrón, el servidor rechaza la cuenta (no depende de la app).
- **Olvidé la contraseña:** el docente la **blanquea** (pestaña Padrón). La app muestra una contraseña temporal; el alumno entra
  con ella y la app lo obliga a elegir una nueva.
- La sesión se cierra sola **a los 7 días** de haber entrado con la contraseña. Hay botón **Cerrar sesión** (menú 👤).

### Roles
| Rol | Quién | Qué puede hacer |
|---|---|---|
| `alumno` | todos los del padrón | ver y entregar **sus** prácticos; ver la devolución si el docente la publica |
| `docente` | lo asigna el admin | ver todas las entregas, corregir, anular, tendencias, padrón, ajustes, exportar, blanquear contraseñas de alumnos |
| `admin` | Diego (se asigna a mano una vez) | todo lo del docente + pantalla **Docentes** (poner/sacar el rol docente) + blanquear a docentes |

**La seguridad está en la base de datos** (políticas RLS y funciones con controles), no solo en la interfaz:
un alumno solo lee su perfil; nadie puede cambiar su propio rol; un docente no puede crear docentes ni admins;
nadie puede volverse admin desde la app. Todo esto tiene pruebas automáticas (`supabase/tests/`).

### Claves de Supabase: cuál va dónde
- **URL del proyecto** y clave **anon / publishable**: son públicas. Van en `src/config.ts`.
- Clave **service_role / secret**: **NUNCA** va en la app ni en el repositorio. Solo la usa la Edge Function
  `blanquear-clave`, y Supabase se la da sola (no hay que pegarla en ningún lado).

---

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto de Supabase
1. Entrá a <https://supabase.com> → **Start your project** → entrá con tu cuenta de GitHub.
2. **New project**. Nombre: `entregas-latu`. Elegí una **Database Password** (guardala en un lugar seguro; casi no se usa).
   Región: **South America (São Paulo)**. Plan **Free**. → **Create new project** y esperá 1–2 minutos.

### 2. Configurar el ingreso (Authentication)
1. Menú izquierdo → **Authentication** → **Sign In / Providers** (o *Providers*) → **Email**.
2. **Desactivá “Confirm email”** (los mails son ficticios: no se manda ningún correo) → **Save**.
3. Dejá activado **“Allow new users to sign up”** (si no, nadie puede usar “Primera vez”; igual solo entran las cédulas del padrón).
4. Opcional: en la misma página, **Minimum password length** = 8.
5. Si en clase muchos alumnos crean su cuenta a la vez desde el mismo wifi y aparece “Demasiados intentos”:
   **Authentication → Rate Limits** y subí el límite de *sign-ups and sign-ins*.

### 3. Crear las tablas y las reglas (SQL)
1. Menú izquierdo → **SQL Editor** → **New query**.
2. Abrí en GitHub cada archivo de `supabase/migrations/` **en orden** (0001, 0002, …), copiá todo, pegalo y tocá **Run**.
   Tiene que decir *Success. No rows returned*.
3. Se pueden volver a correr sin problema (por ejemplo, si una etapa nueva cambia algo).

### 4. Crear la Edge Function para blanquear contraseñas
1. Menú izquierdo → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nombre: **`blanquear-clave`** (exactamente así).
3. Borrá el código de ejemplo y pegá el contenido de `supabase/functions/blanquear-clave/index.ts` → **Deploy function**.
4. En la función → **Details** (o *Settings*) → **desactivá “Verify JWT with legacy secret”** / *Enforce JWT verification*
   → **Save**. (La función comprueba ella misma quién la llama y si es docente.)

### 5. Pegar la URL y la clave pública en la app
1. **Project Settings** (engranaje) → **Data API** (o *API*): copiá la **Project URL**.
2. **Project Settings → API Keys**: copiá la **anon public** (empieza con `eyJ…`) o la **publishable** (`sb_publishable_…`).
3. Pasáselas a Claude para que las ponga en `src/config.ts` (o editalo en GitHub: lápiz ✏️ → pegar entre las comillas →
   *Commit changes*).

### 6. Hacerte admin (primer administrador)
Abrí `supabase/primer_admin.sql`, reemplazá `TU_CEDULA` por tu cédula **solo números con el dígito verificador**
(ej. `1.234.567-2` → `12345672`; si tiene 7 números poné un 0 adelante), y seguí las dos partes:
1. **Parte 1** en el SQL Editor (te agrega al padrón).
2. En la app: **Primera vez** → tu cédula → creá tu contraseña.
3. **Parte 2** en el SQL Editor (`update … set rol = 'admin'`). Salí y volvé a entrar en la app: vas a ver la pestaña **Docentes**.

### 7. Publicar en GitHub Pages
1. En GitHub: repositorio → **Settings → Pages** → *Build and deployment* → **Source: GitHub Actions**.
2. Cada vez que hagas **merge** de un Pull Request a `main`, GitHub corre las pruebas y, si pasan, publica.
   La dirección queda en **Settings → Pages** (algo como `https://gamarrad93-ui.github.io/<repo>/`).

---

## Uso diario

### Dar de alta a un docente
Pestaña **Docentes** (solo admin) → cédula, nombre, apellido → **Hacer docente**. La persona entra con **Primera vez**.
Para quitarlo: **Sacar rol docente** (queda como alumno). A un admin no se le puede cambiar el rol desde la app.

### Cargar el padrón
En la etapa 5 la pestaña **Padrón** permite pegar desde Excel o subir un CSV. Mientras tanto, en el **SQL Editor**:
```sql
insert into padron (cedula, nombre, apellido, grupo) values
  ('12345672', 'Ana', 'Pérez', 'G1'),
  ('44444444', 'Bruno', 'Silva', 'G2');
```
(cédula solo números, 8 dígitos con el verificador; si la cédula está mal, la base la rechaza).

### Blanquear una contraseña
Pestaña **Padrón** → **Blanquear contraseña** → cédula → **Blanquear**. Aparece la contraseña temporal: dásela al alumno.
Un docente puede blanquear alumnos; el admin también puede blanquear docentes.

**Si el admin se olvida su contraseña** (nadie lo puede blanquear desde la app), en el SQL Editor:
```sql
update auth.users
   set encrypted_password = extensions.crypt('UnaClaveNueva123', extensions.gen_salt('bf'))
 where email = 'TU_CEDULA@entregas.local';
```

### Empezar un semestre nuevo
(Se completa en la etapa 5 con los pasos de la interfaz.) En resumen: exportar a Excel lo del semestre anterior,
dar de baja (o borrar) el padrón viejo, cargar el nuevo, revisar fechas límite y ajustes.

---

## Para desarrollar

```bash
npm install
npm run dev      # app local en http://localhost:5173
npm test         # motor + reglas de permisos (Postgres real en memoria con PGlite)
npm run build
```

- `src/chem/practicos/` — motor de corrección (puro, sin React). Para **agregar un práctico**: definir su `PracticaDef` en
  `practicas.ts` (planilla, cálculo y resultados), sumarlo a `PRACTICAS` y agregar pruebas.
- `src/lib/cedula.ts` — validación de la cédula.
- `src/auth/` — ingreso, primera vez, cambio de contraseña, sesión de 7 días.
- `src/docente/`, `src/alumno/` — pantallas por rol.
- `supabase/migrations/` — todo el SQL (tablas, RLS, funciones), en orden y re-ejecutable.
- `supabase/functions/blanquear-clave/` — Edge Function (única que usa la service_role).
- `supabase/tests/` — pruebas de permisos: corren las migraciones sobre un Postgres real (PGlite) con una imitación
  mínima de Supabase (`shim-supabase.sql`).
