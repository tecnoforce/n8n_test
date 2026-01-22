'use client';

import { useState, useRef, useEffect, DragEvent } from 'react';

export default function Home() {
  const [files, setFiles] = useState<{ char: File | null; prod: File | null }>({
    char: null,
    prod: null,
  });
  const [previews, setPreviews] = useState<{ char: string | null; prod: string | null }>({
    char: null,
    prod: null,
  });
  const [instructions, setInstructions] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ msg: string; type: 'success' | 'error' | 'loading' | '' }>({ msg: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [resultImg, setResultImg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Background Canvas Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
        this.color = Math.random() > 0.5 ? '#00f3ff' : '#ff00ff';
        this.alpha = Math.random() * 0.5 + 0.1;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }

      draw() {
        if (!ctx) return;
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const particles: Particle[] = [];
    for (let i = 0; i < 50; i++) particles.push(new Particle());

    let animationId: number;
    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleFile = (file: File | undefined, type: 'char' | 'prod') => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus({ msg: 'Error: La imagen supera los 10MB', type: 'error' });
      return;
    }

    // Cleanup old preview
    if (previews[type]) URL.revokeObjectURL(previews[type]!);

    setFiles((prev) => ({ ...prev, [type]: file }));
    setPreviews((prev) => ({ ...prev, [type]: URL.createObjectURL(file) }));
    setStatus({ msg: '', type: '' });
  };

  const onDrop = (e: DragEvent<HTMLDivElement>, type: 'char' | 'prod') => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0], type);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
  };

  const submitForm = async () => {
    if (!files.char || !files.prod) {
      setStatus({ msg: 'Por favor, sube ambas imágenes (Personaje y Producto)', type: 'error' });
      return;
    }
    if (!email || !email.includes('@')) {
      setStatus({ msg: 'Por favor, introduce un email válido', type: 'error' });
      return;
    }

    setLoading(true);
    setStatus({ msg: 'GENERANDO...', type: 'loading' });
    setResultImg(null);

    const formData = new FormData();
    formData.append('character_image', files.char);
    formData.append('product_image', files.prod);
    formData.append('instructions', instructions);
    formData.append('email', email);
    formData.append('client_timestamp', new Date().toISOString());

    try {
      const response = await fetch('https://n8nclinica.proasures.es/webhook/publi_imagen', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setStatus({ msg: `¡Perfecto! Recibirás el anuncio en: ${email}`, type: 'success' });

        // Handle response image
        try {
          const contentType = response.headers.get('content-type');
          let imageUrl: string | null = null;

          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            imageUrl = data.url || data.imageUrl || data.image || data.output || data.output_image || data.data;
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:image')) {
              imageUrl = `data:image/png;base64,${imageUrl}`;
            }
          } else if (contentType && contentType.startsWith('image/')) {
            const blob = await response.blob();
            imageUrl = URL.createObjectURL(blob);
          }

          if (imageUrl) {
            setResultImg(imageUrl);
            setTimeout(() => {
              resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        } catch (e) {
          console.warn("No se pudo procesar la imagen de la respuesta:", e);
        }

      } else {
        throw new Error('Error en el servidor');
      }
    } catch (error) {
      console.error(error);
      setStatus({ msg: 'Ocurrió un error al enviar. Por favor intenta de nuevo.', type: 'error' });
    } finally {
      setLoading(false);
      if (status.type === 'loading') setStatus({ msg: '', type: '' }); // Clear if only loading
    }
  };

  return (
    <>
      <canvas ref={canvasRef} id="bg-canvas"></canvas>

      <div className="container">
        <header>
          <h1 data-text="ANEXO">ANEXO</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', letterSpacing: '2px' }}>
            GENERADOR DE ANUNCIOS IA
          </p>
        </header>

        <div className="upload-section">
          {/* Character Image */}
          <div className="card">
            <h2>Personaje</h2>
            <div
              className={`preview-area ${previews.char ? 'has-image' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, 'char')}
              onClick={() => document.getElementById('file-char')?.click()}
            >
              <div className="placeholder">
                <p>Arrastra o haz clic</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>(Máx 10MB)</p>
              </div>
              {previews.char && <img src={previews.char} alt="Previsualización Personaje" />}
            </div>
            <button className="btn-select" onClick={() => document.getElementById('file-char')?.click()}>
              Seleccionar Archivo
            </button>
            <input
              type="file"
              id="file-char"
              className="file-input"
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => handleFile(e.target.files?.[0], 'char')}
            />
          </div>

          {/* Product Image */}
          <div className="card">
            <h2>Producto</h2>
            <div
              className={`preview-area ${previews.prod ? 'has-image' : ''}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, 'prod')}
              onClick={() => document.getElementById('file-prod')?.click()}
            >
              <div className="placeholder">
                <p>Arrastra o haz clic</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>(Máx 10MB)</p>
              </div>
              {previews.prod && <img src={previews.prod} alt="Previsualización Producto" />}
            </div>
            <button className="btn-select" onClick={() => document.getElementById('file-prod')?.click()}>
              Seleccionar Archivo
            </button>
            <input
              type="file"
              id="file-prod"
              className="file-input"
              accept="image/png, image/jpeg, image/webp"
              onChange={(e) => handleFile(e.target.files?.[0], 'prod')}
            />
          </div>
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="instructions">Instrucciones / Prompt</label>
            <textarea
              id="instructions"
              placeholder="Describe cómo quieres que sea tu anuncio..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            ></textarea>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email de Recepción *</label>
            <input
              type="email"
              id="email"
              placeholder="usuario@ejemplo.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button id="submit-btn" className="btn-submit" onClick={submitForm} disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div> GENERANDO...
              </>
            ) : (
              <span>GENERAR ANUNCIO</span>
            )}
          </button>

          <div className={`status-message ${status.msg ? 'visible ' + status.type : ''}`}>
            {status.msg}
          </div>
        </div>

        <div id="result-section" className={`result-section ${resultImg ? 'visible' : ''}`} ref={resultRef}>
          <h2 style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>Resultado Generado</h2>
          <div className="result-container">
            {resultImg && <img id="result-img" className="result-image" src={resultImg} alt="Anuncio Generado" />}
          </div>
          {resultImg && (
            <a
              id="download-btn"
              href={resultImg}
              download="anuncio_anexo.png"
              className="btn-submit"
              style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center', marginTop: '1rem', fontSize: '1rem' }}
            >
              Descargar Imagen
            </a>
          )}
          <button id="regenerate-btn" className="btn-submit"
            style={{ marginTop: '0.5rem', background: 'linear-gradient(45deg, var(--secondary), var(--primary))' }}
            onClick={submitForm} // Re-use submit logic for regeneration
            disabled={loading}
          >
            REGENERAR (Mismos Datos)
          </button>
        </div>
      </div>
    </>
  );
}
