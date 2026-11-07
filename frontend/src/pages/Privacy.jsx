import { Link } from 'react-router-dom';
import { useFetch } from '../hooks.js';
import './Privacy.css';
import { usePageMeta } from '../pageMeta.js';

// Aviso de privacidad. Es un BORRADOR razonable: debe revisarlo la ENSFA o alguien con conocimiento legal antes de darlo
// por definitivo (ver README → «Privacidad y retención»). Si cambia lo que se guarda o por cuánto tiempo, hay que
// actualizar este texto.
export default function Privacy() {
  usePageMeta({ title: 'Aviso de privacidad', description: 'Cómo cuidamos los datos y mensajes que nos compartes en el buzón de Generación de Impacto.' });
  const { data: settings } = useFetch('/settings');
  const email = settings?.social?.email;
  return (
    <section className="section paper page-min">
      <div className="container narrow privacy">
        <h1 className="title">Aviso de <mark>privacidad</mark></h1>
        <p className="lead">Cómo cuidamos lo que nos cuentas en el buzón y en este sitio.</p>

        <h2>¿Quién es responsable?</h2>
        <p>
          La planilla <strong>Generación de Impacto</strong>, del Consejo Estudiantil de la Escuela Normal Superior Federal de
          Aguascalientes (ENSFA) «Profr. José Santos Valdés», es responsable del tratamiento de los datos que se reciben a
          través de este sitio.
        </p>

        <h2>¿Qué datos recibimos?</h2>
        <ul>
          <li>
            <strong>Mensajes anónimos:</strong> solo el asunto, el texto, el tipo de mensaje y las imágenes que adjuntes. <strong>No
            guardamos ningún dato personal</strong>: ni nombre, ni teléfono, ni licenciatura, ni grupo, ni tu dirección IP. A las
            imágenes se les eliminan los metadatos (como la ubicación o el modelo de la cámara) al recibirlas.
          </li>
          <li>
            <strong>Mensajes con tus datos</strong> (solo si tú decides enviarlos así): nombre completo, teléfono, licenciatura,
            semestre y, en su caso, grupo, además del contenido del mensaje. Antes de enviarlos te pedimos aceptar este aviso y
            guardamos la fecha en que lo aceptaste.
          </li>
          <li><strong>Integrantes de la planilla:</strong> nombre, correo y contraseña (guardada cifrada) para entrar al panel.</li>
        </ul>

        <h2>¿Para qué los usamos?</h2>
        <p>
          Únicamente para leer, atender y dar seguimiento a lo que nos escribes y, si enviaste tus datos, para contactarte sobre
          tu mensaje. No los usamos para publicidad, no los vendemos y no los compartimos con terceros.
        </p>

        <h2>¿Quién puede verlos?</h2>
        <p>
          Solo integrantes de la planilla con una cuenta en el panel. Algunos integrantes tienen un acceso limitado como
          moderadores: leen y clasifican los mensajes, pero <strong>no ven los datos de contacto</strong>. Las imágenes adjuntas
          son privadas y no se pueden abrir sin iniciar sesión. Las acciones del panel se registran (quién hizo qué), sin copiar
          el contenido de los mensajes.
        </p>

        <h2>¿Cuánto tiempo los conservamos?</h2>
        <p>
          Mientras se atiende tu mensaje. Los mensajes que se eliminan pasan 30 días en una papelera y después se borran
          definitivamente junto con sus imágenes. Los mensajes ya resueltos o archivados se borran también al cumplirse el plazo de
          conservación que defina el Consejo Estudiantil.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes pedir en cualquier momento <strong>acceder</strong> a tus datos, <strong>corregirlos</strong>,
          {' '}<strong>cancelarlos</strong> (que los borremos) u <strong>oponerte</strong> a su uso, y retirar tu consentimiento.
          {email ? (
            <> Escríbenos a <a href={`mailto:${email}`}>{email}</a> indicando el asunto de tu mensaje y cómo te contactamos.</>
          ) : (
            <> Contacta a cualquier integrante de la planilla desde la página de <Link to="/equipo">Equipo</Link>.</>
          )}
        </p>

        <h2>Cambios a este aviso</h2>
        <p>Si cambia la forma en que tratamos los datos, actualizaremos esta página. Última actualización: 6 de noviembre de 2026.</p>
      </div>
    </section>
  );
}
