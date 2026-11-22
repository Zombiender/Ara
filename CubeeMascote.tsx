/**
 * Mascote Cubee (port de cubee_neo_avatar_interativo.html).
 * Mesmo desenho em canvas, mesmos parâmetros do cubee.avatar.json e mesmas
 * expressões, adaptados para um componente React pequeno (ex.: na ilha em repouso).
 */
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

export type ExpressaoCubee =
  | 'idle' | 'listening' | 'thinking' | 'working' | 'success' | 'error'
  | 'permission' | 'tracking' | 'poked' | 'dizzy' | 'dragged' | 'sleeping'
  | 'notification' | 'swallow' | 'dancing' | 'seasonal' | 'pending' | 'denied';

interface CubeeMascoteProps {
  /** Expressão base vinda do estado do app. Cliques e arrasto têm prioridade temporária. */
  expressao: ExpressaoCubee;
  /** Tamanho do canvas em px. */
  tamanho?: number;
}

// Parâmetros exatos do cubee.avatar.json
const CORPO = {
  largura: 191.49921875,
  altura: 191.49921875,
  profundidade: 171.95848214285726,
  arredondamento: 0.73265625,
};
const OLHOS_DESLOC_Y = -0.07310734785961104;

// Paleta do tema "Cubee Indigo-Purple" (tema padrão do original)
const CORES = {
  escuro: '#0b1536',
  medio: '#1e1b4b',
  roxo: '#6d28d9',
  borda: '#a855f7',
  olho: '#f3e8ff',
};

const AREA = 230;                 // área de desenho em unidades do original
const JANELA_CLIQUES_MS = 650;    // 4 cliques dentro desse tempo = tonto
const ARRASTE_MIN_PX = 12;
const TRANSIENTES: ExpressaoCubee[] = ['poked', 'dizzy', 'dragged'];

interface Anim {
  eyeX: number; eyeY: number;
  faceX: number; faceY: number;
  earX: number; earY: number;
  earAngleL: number; earAngleR: number;
  eyeOpen: number; eyeScale: number;
  headScaleX: number; headScaleY: number;
  headTilt: number; headOffsetX: number; headOffsetY: number;
  mouthOpen: number;
  pawLeftY: number; pawRightY: number;
  fileProgress: number;
}

const animInicial = (): Anim => ({
  eyeX: 0, eyeY: 0, faceX: 0, faceY: 0, earX: 0, earY: 0,
  earAngleL: 0, earAngleR: 0, eyeOpen: 1, eyeScale: 1,
  headScaleX: 1, headScaleY: 1, headTilt: 0, headOffsetX: 0, headOffsetY: 0,
  mouthOpen: 0, pawLeftY: 0, pawRightY: 0, fileProgress: 0,
});

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Primitiva squircle (mesma do original). */
function drawSquircle(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const w = width / 2, h = height / 2, r = Math.min(radius, w, h);
  ctx.beginPath();
  ctx.moveTo(x - w + r, y - h);
  ctx.lineTo(x + w - r, y - h);
  ctx.quadraticCurveTo(x + w, y - h, x + w, y - h + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x - w + r, y + h);
  ctx.quadraticCurveTo(x - w, y + h, x - w, y + h - r);
  ctx.lineTo(x - w, y - h + r);
  ctx.quadraticCurveTo(x - w, y - h, x - w + r, y - h);
  ctx.closePath();
}

export default function CubeeMascote({ expressao, tamanho = 26 }: CubeeMascoteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anim = useRef<Anim>(animInicial());
  const st = useRef({
    estado: expressao as ExpressaoCubee,
    base: expressao as ExpressaoCubee,
    tempo: 0,
    cliques: 0,
    timerCliques: 0,
    arrastando: false,
    inicioArraste: { x: 0, y: 0 },
    ponteiro: { x: 0, y: 0 },
    proximoPiscar: 2.5,
  });

  const definirEstado = (novo: ExpressaoCubee) => {
    const s = st.current;
    s.estado = novo;
    s.tempo = 0;
    if (novo === 'swallow') anim.current.fileProgress = 0;
  };

  // Expressão base acompanha o estado do app (sem interromper uma interação em curso)
  useEffect(() => {
    const s = st.current;
    s.base = expressao;
    if (!TRANSIENTES.includes(s.estado)) definirEstado(expressao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expressao]);

  // Canvas, loop de animação e eventos globais
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const s = st.current;
    const a = anim.current;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${tamanho}px`;
    canvas.style.height = `${tamanho}px`;
    canvas.width = Math.round(tamanho * dpr);
    canvas.height = Math.round(tamanho * dpr);
    const escala = canvas.width / AREA;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);

    const aoMover = (e: PointerEvent) => {
      s.ponteiro = { x: e.clientX, y: e.clientY };
      if (!s.arrastando) return;
      const dx = e.clientX - s.inicioArraste.x;
      const dy = e.clientY - s.inicioArraste.y;
      if (Math.hypot(dx, dy) > ARRASTE_MIN_PX) {
        if (s.estado !== 'dragged') definirEstado('dragged');
        a.headOffsetX = clamp(dx * 0.25, -24, 24);
        a.headOffsetY = clamp(dy * 0.25, -24, 24);
      }
    };

    const aoSoltar = () => {
      if (s.arrastando && s.estado === 'dragged') definirEstado(s.base);
      s.arrastando = false;
    };

    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);

    const desenhar = (agora: number) => {
      const dt = Math.min((agora - ultimo) / 1000, 0.05);
      ultimo = agora;
      const t = agora / 1000;
      s.tempo += dt;

      // Retornos automáticos das expressões transitórias
      if (s.estado === 'poked' && s.tempo > 0.5) definirEstado(s.base);
      if (s.estado === 'dizzy' && s.tempo > 2.2) definirEstado(s.base);
      if (s.estado === 'notification' && s.tempo > 2.5) definirEstado('idle');
      if (s.estado === 'swallow' && s.tempo > 1.7) definirEstado('success');
      if (s.estado === 'denied' && s.tempo > 1.8) definirEstado('idle');

      const estado = s.estado;
      const cx = AREA / 2;
      const cy = AREA / 2 + 2;
      const boxW = CORPO.largura;
      const boxH = CORPO.altura;
      const raioCanto = (boxW / 2) * CORPO.arredondamento;
      const R = boxW * 0.24;

      ctx.clearRect(0, 0, AREA, AREA);

      // Eye-tracking (escala ajustada ao tamanho pequeno do ícone)
      const rect = canvas.getBoundingClientRect();
      const dx = s.ponteiro.x - (rect.left + rect.width / 2);
      const dy = s.ponteiro.y - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      const forca = Math.tanh(dist / 40);
      const angulo = Math.atan2(dy, dx);

      let alvoEyeX = Math.cos(angulo) * forca * (R * 0.28);
      let alvoEyeY = Math.sin(angulo) * forca * (R * 0.22);
      const respira = Math.sin(t * 1.8);
      let alvoEscalaY = 1 + respira * 0.018;
      let alvoEscalaX = 1 - respira * 0.012;
      let alvoDeslocX = 0;
      let alvoDeslocY = Math.cos(t * 1.8) * 1.8;
      let alvoInclinacao = 0;
      let alvoOlhoAberto = 1;
      let alvoOlhoEscala = 1;
      let alvoOrelhaL = Math.sin(t * 0.9) * 0.03;
      let alvoOrelhaR = Math.sin(t * 0.9 + 0.5) * 0.03;
      let alvoBoca = 0;
      let alvoPatinhaL = 0, alvoPatinhaR = 0;

      if (t > s.proximoPiscar && !['sleeping', 'dizzy', 'poked', 'success', 'pending'].includes(estado)) {
        alvoOlhoAberto = 0.06;
        if (t > s.proximoPiscar + 0.14) s.proximoPiscar = t + 2.5 + Math.random() * 3.5;
      }

      // Máquina de expressões
      switch (estado) {
        case 'listening': {
          alvoOrelhaL = -0.18 + Math.sin(t * 6) * 0.05;
          alvoOrelhaR = 0.18 - Math.sin(t * 6) * 0.05;
          alvoOlhoEscala = 1.12;
          alvoInclinacao = (alvoEyeX / R) * 0.16;
          break;
        }
        case 'thinking': {
          alvoEyeX = Math.cos(t * 3) * (R * 0.26);
          alvoEyeY = -R * 0.22;
          alvoInclinacao = 0.06;
          break;
        }
        case 'working': {
          alvoEyeX = Math.sin(t * 14) * (R * 0.20);
          alvoEyeY = R * 0.08;
          alvoPatinhaL = -R * 0.35 + Math.sin(t * 28) * 4;
          alvoPatinhaR = -R * 0.35 + Math.cos(t * 28) * 4;
          break;
        }
        case 'success': {
          alvoDeslocY = -Math.abs(Math.sin(t * 7)) * 7;
          break;
        }
        case 'error': {
          alvoInclinacao = Math.sin(t * 35) * 0.07;
          alvoOrelhaL = 0.35;
          alvoOrelhaR = -0.35;
          break;
        }
        case 'permission': {
          alvoOlhoEscala = 1.22;
          alvoPatinhaR = -R * 0.42 + Math.sin(t * 8) * 5;
          break;
        }
        case 'poked': {
          alvoEscalaX = 1.09; alvoEscalaY = 0.92; alvoOlhoAberto = 0.1;
          break;
        }
        case 'dizzy': {
          alvoInclinacao = Math.sin(t * 16) * 0.10;
          break;
        }
        case 'dragged': {
          alvoEscalaX = 0.93; alvoEscalaY = 1.08;
          alvoPatinhaL = R * 0.18 + Math.sin(t * 10) * 4;
          alvoPatinhaR = R * 0.18 - Math.sin(t * 10) * 4;
          break;
        }
        case 'sleeping': {
          alvoOlhoAberto = 0.05; alvoDeslocY = 4;
          alvoOrelhaL = 0.20; alvoOrelhaR = -0.20;
          break;
        }
        case 'notification': {
          alvoOrelhaL = -0.22; alvoOrelhaR = 0.22;
          alvoDeslocY = -Math.max(0, Math.sin(s.tempo * 10)) * 7;
          break;
        }
        case 'swallow': {
          a.fileProgress = Math.min(1, s.tempo / 1.1);
          const eat = Math.sin(a.fileProgress * Math.PI);
          alvoEscalaX = 1 + eat * 0.10; alvoEscalaY = 1 + eat * 0.10;
          alvoBoca = eat;
          break;
        }
        case 'dancing': {
          const batida = Math.abs(Math.sin(t * 6.5));
          alvoDeslocY = -batida * 6;
          alvoInclinacao = Math.sin(t * 3.25) * 0.10;
          alvoPatinhaL = -R * 0.25 - batida * 5;
          alvoPatinhaR = -R * 0.25 - (1 - batida) * 5;
          break;
        }
        case 'pending': {
          // Side-eye sério (😒)
          alvoEyeX = R * 0.26;
          alvoEyeY = R * 0.02;
          break;
        }
        case 'denied': {
          // Rotação lateral da cabeça (🙂‍↔️)
          const balanco = Math.sin(s.tempo * 15) * Math.exp(-s.tempo * 1.15);
          alvoDeslocX = balanco * (R * 0.18);
          alvoInclinacao = balanco * 0.08;
          alvoEyeX = balanco * (R * 0.38);
          alvoEyeY = Math.abs(balanco) * (R * 0.04);
          alvoEscalaX = 1 - Math.abs(balanco) * 0.05;
          alvoOrelhaL = -0.12 + balanco * 0.12;
          alvoOrelhaR = 0.12 + balanco * 0.12;
          break;
        }
        default:
          break;
      }

      // Suavização
      const suave = 0.18;
      a.eyeX += (alvoEyeX - a.eyeX) * suave;
      a.eyeY += (alvoEyeY - a.eyeY) * suave;
      const pesoRosto = estado === 'denied' ? 0.65 : 0.42;
      const pesoOrelha = estado === 'denied' ? -0.35 : -0.20;
      a.faceX += (alvoEyeX * pesoRosto - a.faceX) * suave;
      a.faceY += (alvoEyeY * 0.42 - a.faceY) * suave;
      a.earX += (alvoEyeX * pesoOrelha - a.earX) * suave;
      a.earY += (-alvoEyeY * 0.20 - a.earY) * suave;
      a.headScaleX += (alvoEscalaX - a.headScaleX) * suave;
      a.headScaleY += (alvoEscalaY - a.headScaleY) * suave;
      a.headOffsetX += (alvoDeslocX - a.headOffsetX) * suave;
      a.headOffsetY += (alvoDeslocY - a.headOffsetY) * suave;
      a.headTilt += (alvoInclinacao - a.headTilt) * suave;
      a.eyeOpen += (alvoOlhoAberto - a.eyeOpen) * 0.35;
      a.eyeScale += (alvoOlhoEscala - a.eyeScale) * suave;
      a.earAngleL += (alvoOrelhaL - a.earAngleL) * suave;
      a.earAngleR += (alvoOrelhaR - a.earAngleR) * suave;
      a.mouthOpen += (alvoBoca - a.mouthOpen) * 0.25;
      a.pawLeftY += (alvoPatinhaL - a.pawLeftY) * 0.22;
      a.pawRightY += (alvoPatinhaR - a.pawRightY) * 0.22;

      // Cores por expressão
      let corEscura = CORES.escuro;
      let corMedia = CORES.medio;
      let corRoxa = CORES.roxo;
      let corBorda = CORES.borda;
      let corOlho = CORES.olho;

      if (estado === 'error' || estado === 'denied') {
        corEscura = '#1f091d'; corMedia = '#4c0519'; corRoxa = '#e11d48';
        corBorda = '#fb7185'; corOlho = '#ffe4e6';
      } else if (estado === 'success') {
        corEscura = '#09192f'; corMedia = '#1e1b4b'; corRoxa = '#10b981';
        corBorda = '#6ee7b7'; corOlho = '#ecfdf5';
      } else if (estado === 'thinking') {
        corEscura = '#0c0a2a'; corMedia = '#2e1065'; corRoxa = '#9333ea';
        corBorda = '#d8b4fe';
      } else if (estado === 'listening') {
        corEscura = '#041434'; corMedia = '#073585'; corRoxa = '#0061fe';
        corBorda = '#38bdf8'; corOlho = '#e0f2fe';
      }

      ctx.save();
      ctx.translate(cx + a.headOffsetX, cy + a.headOffsetY);
      ctx.rotate(a.headTilt);
      ctx.scale(a.headScaleX, a.headScaleY);

      const profundidadeDeslocada = (CORPO.profundidade / CORPO.altura) * 11;
      const paralaxeX = a.faceX * 0.22;
      const paralaxeY = a.faceY * 0.18;

      // 0. Ondas sonoras no estado "ouvindo"
      if (estado === 'listening') {
        ctx.save();
        const expansaoMax = AREA - boxW - 22;
        for (let i = 0; i < 3; i++) {
          const progresso = (t * 0.55 + i / 3) % 1;
          const expansao = 8 + progresso * expansaoMax;
          const alfa = Math.pow(1 - progresso, 1.6) * 0.65;
          drawSquircle(ctx, 0, profundidadeDeslocada * 0.4, boxW + expansao, boxH + expansao, raioCanto + expansao * 0.5);
          ctx.strokeStyle = `rgba(56, 189, 248, ${alfa.toFixed(3)})`;
          ctx.lineWidth = 2.2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 1. Extrusão 3D (profundidade)
      ctx.save();
      ctx.shadowColor = corRoxa;
      ctx.shadowBlur = 28;
      drawSquircle(ctx, -paralaxeX * 0.4, profundidadeDeslocada - paralaxeY * 0.3, boxW, boxH, raioCanto);
      const gradProfundidade = ctx.createLinearGradient(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2 + profundidadeDeslocada);
      gradProfundidade.addColorStop(0, '#040714');
      gradProfundidade.addColorStop(0.5, corEscura);
      gradProfundidade.addColorStop(1, corRoxa);
      ctx.fillStyle = gradProfundidade;
      ctx.fill();
      ctx.restore();

      // 2. Corpo principal
      drawSquircle(ctx, 0, 0, boxW, boxH, raioCanto);
      const gradCubo = ctx.createLinearGradient(-boxW * 0.45, -boxH * 0.45, boxW * 0.5, boxH * 0.5);
      gradCubo.addColorStop(0, corEscura);
      gradCubo.addColorStop(0.52, corMedia);
      gradCubo.addColorStop(1, corRoxa);
      ctx.fillStyle = gradCubo;
      ctx.fill();

      ctx.save();
      ctx.clip();
      const brilhoTopo = ctx.createRadialGradient(-boxW * 0.22, -boxH * 0.28, 8, -boxW * 0.1, -boxH * 0.15, boxW * 0.85);
      brilhoTopo.addColorStop(0, 'rgba(192, 132, 252, 0.24)');
      brilhoTopo.addColorStop(0.45, 'rgba(59, 130, 246, 0.08)');
      brilhoTopo.addColorStop(1, 'rgba(5, 8, 22, 0.45)');
      ctx.fillStyle = brilhoTopo;
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

      const luzInferior = ctx.createLinearGradient(0, boxH * 0.1, 0, boxH * 0.52);
      luzInferior.addColorStop(0, 'rgba(109, 40, 217, 0)');
      luzInferior.addColorStop(1, corBorda);
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = luzInferior;
      ctx.fillRect(-boxW / 2, 0, boxW, boxH / 2);
      ctx.restore();

      ctx.lineWidth = 2.4;
      const gradBorda = ctx.createLinearGradient(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2);
      gradBorda.addColorStop(0, 'rgba(147, 197, 253, 0.55)');
      gradBorda.addColorStop(0.45, 'rgba(139, 92, 246, 0.25)');
      gradBorda.addColorStop(1, corBorda);
      ctx.strokeStyle = gradBorda;
      ctx.stroke();

      // 3. Rosto
      ctx.save();
      ctx.translate(a.faceX * 0.45, a.faceY * 0.35);

      const espacoOlhos = boxW * 0.165;
      const olhoBaseY = boxH * OLHOS_DESLOC_Y;

      [-1, 1].forEach((dir) => {
        const ex = dir * espacoOlhos + a.eyeX;
        const ey = olhoBaseY + a.eyeY;
        ctx.save();
        ctx.translate(ex, ey);
        ctx.shadowColor = corBorda;
        ctx.shadowBlur = 16;

        if (estado === 'success') {
          ctx.beginPath();
          ctx.arc(0, 5, 11.5, Math.PI * 1.15, Math.PI * 1.85);
          ctx.lineWidth = 4.4;
          ctx.lineCap = 'round';
          ctx.strokeStyle = corOlho;
          ctx.stroke();
        } else if (estado === 'dizzy') {
          ctx.beginPath();
          const q = 9;
          ctx.moveTo(-dir * q, -q); ctx.lineTo(dir * q, 0); ctx.lineTo(-dir * q, q);
          ctx.lineWidth = 4.2;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.strokeStyle = corOlho;
          ctx.stroke();
        } else if (estado === 'pending') {
          const ew = 19.5;
          const eh = 33;
          drawSquircle(ctx, 0, 0, ew, eh, ew / 2);
          ctx.fillStyle = corOlho;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = corMedia;
          ctx.fillRect(-ew * 0.9, -eh * 0.72, ew * 1.8, eh * 0.7);
          ctx.beginPath();
          ctx.moveTo(-ew * 0.78, -eh * 0.02);
          ctx.lineTo(ew * 0.78, -eh * 0.02);
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.strokeStyle = corOlho;
          ctx.stroke();
        } else {
          const ew = Math.max(4, 20 * a.eyeScale);
          const eh = Math.max(3.5, 34 * a.eyeScale * a.eyeOpen);
          drawSquircle(ctx, 0, 0, ew, eh, ew / 2);
          ctx.fillStyle = corOlho;
          ctx.fill();
          if (a.eyeOpen > 0.4) {
            ctx.shadowBlur = 0;
            drawSquircle(ctx, 0, 0, ew * 0.65, eh * 0.72, (ew * 0.65) / 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          }
        }
        ctx.restore();
      });

      // Óculos de sol (seasonal)
      if (estado === 'seasonal') {
        ctx.save();
        ctx.translate(a.eyeX, olhoBaseY + a.eyeY);
        ctx.fillStyle = 'rgba(9, 13, 38, 0.92)';
        ctx.strokeStyle = corBorda;
        ctx.lineWidth = 2;
        drawSquircle(ctx, -espacoOlhos, 0, 32, 20, 5); ctx.fill(); ctx.stroke();
        drawSquircle(ctx, espacoOlhos, 0, 32, 20, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = corBorda;
        ctx.fillRect(-espacoOlhos + 15, -2, (espacoOlhos - 15) * 2, 3);
        ctx.restore();
      }

      // Boca (engolir arquivo)
      if (a.mouthOpen > 0.12) {
        ctx.beginPath();
        ctx.arc(a.faceX * 0.5, olhoBaseY + 24, 10 * a.mouthOpen, 0, Math.PI * 2);
        ctx.fillStyle = corBorda;
        ctx.fill();
      }

      ctx.restore(); // fim da camada do rosto

      // 4. Patinhas
      if (['working', 'permission', 'dragged', 'dancing'].includes(estado)) {
        const patinhaY = boxH * 0.44;
        ctx.shadowColor = corRoxa;
        ctx.shadowBlur = 12;
        drawSquircle(ctx, -boxW * 0.24, patinhaY + a.pawLeftY, 26, 17, 8.5);
        ctx.fillStyle = corMedia;
        ctx.fill();
        ctx.strokeStyle = corBorda;
        ctx.lineWidth = 2;
        ctx.stroke();
        drawSquircle(ctx, boxW * 0.24, patinhaY + a.pawRightY, 26, 17, 8.5);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
    };

    let rafId = 0;
    let ultimo = performance.now();
    const frame = (agora: number) => {
      desenhar(agora);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
      window.clearTimeout(s.timerCliques);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tamanho]);

  /** Clique/toque: "cutucado"; 4 cliques rápidos: "tonto"; arrastar: "arrastado". */
  const aoPressionar = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.stopPropagation(); // não abre a ilha ao mexer no mascote
    const s = st.current;
    s.arrastando = true;
    s.inicioArraste = { x: e.clientX, y: e.clientY };
    s.cliques += 1;
    window.clearTimeout(s.timerCliques);
    s.timerCliques = window.setTimeout(() => { s.cliques = 0; }, JANELA_CLIQUES_MS);
    if (s.cliques >= 4) {
      s.cliques = 0;
      definirEstado('dizzy');
    } else if (s.estado !== 'dizzy') {
      definirEstado('poked');
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={aoPressionar}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 cursor-grab active:cursor-grabbing"
      aria-label="Mascote Cubee"
    />
  );
}
