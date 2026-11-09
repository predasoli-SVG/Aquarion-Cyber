# The Cyber-Aquarium

Uma expedição editorial em quatro capítulos, com Three.js, GLSL, GSAP ScrollTrigger e Lenis. O scroll desmonta um peixe feito de sucata eletrônica, dispersa sua matéria em partículas e recompõe um manifesto.

A edição entregue funciona sem baixar modelos, HDRs, bibliotecas ou áudio de CDNs em tempo de execução. O peixe procedural de 278 peças é o asset inicial; o ponto de entrada para um GLB de produção está documentado.

## Executar

Requer Node.js 22 e npm.

```sh
npm ci
npm run dev
```

Abra o endereço que o Vite imprimir no terminal. Para gerar a versão estática:

```sh
npm run check
npm run build
npm run preview
```

Publique o conteúdo de `dist/` em uma hospedagem estática HTTPS. Não abra `index.html` por `file://`: ES modules e texturas precisam de um servidor HTTP. Não há backend, credenciais, banco ou serviços pagos obrigatórios.

## O que está implementado

| Recurso | Implementação |
| --- | --- |
| Peixe | 278 peças procedurais, sete lotes de material PBR, cobre, circuitos, sensores emissivos e barbatanas |
| Desmonte | Transformação rígida por peça no vertex shader; um `uProgress` compartilhado |
| Scroll | Lenis no ticker do GSAP; `ScrollTrigger.update`; capítulos fixados; reprodução reversível |
| Materiais | `MeshPhysicalMaterial`, mapas procedurais de normal/rugosidade, clearcoat, iridescência e IBL via PMREM |
| Ambiente HDR | Loader preparado; a versão autônoma usa um ambiente procedural |
| Iluminação aquática | Cáusticas procedurais animadas e integração volumétrica de espalhamento simples com oclusão por profundidade |
| Óptica | DOF variável com abertura de 12 amostras, bloom, ACES, FXAA, aberração cromática e grain |
| Dissolução | InstancedMesh com até 50.000 partículas; origem amostrada por área nos triângulos reais do peixe |
| Fluxo | Campo de curl analítico no shader, agitado pela velocidade do scroll |
| Manifesto | Destinos amostrados de uma máscara de texto; as mesmas instâncias formam a tipografia |
| Infográficos | Dois pontos das peças projetados na tela e conectados a rótulos por vetores SVG |
| Título | CanvasTexture com distorção GLSL; o título semântico permanece no HTML |
| Som | Ambiente procedural opt-in com Web Audio; sem autoplay |
| Acessibilidade | Navegação por teclado, diálogos nativos, movimento reduzido e versão de leitura sem WebGL |
| Robustez | Qualidade ajustável, pausa de renderização em aba oculta e descarte de recursos |

## Módulos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/main.js` | Inicialização, fallback e ciclo de vida |
| `src/config.js` | Contrato de assets e perfis de qualidade |
| `src/core/Aquarium.js` | Orquestração da cena e renderização |
| `src/core/ScrollDirector.js` | Relógio único e estado narrativo derivado do scroll |
| `src/core/Pipeline.js` | EffectComposer, depth texture, DOF, volumetria e efeitos de lente |
| `src/core/Resources.js` | Ownership e descarte de geometrias, mapas e passes |
| `src/core/Audio.js` | Geração do ambiente sonoro |
| `src/scene/Fish.js` | Geometria procedural, lotes por material e carregamento de GLB |
| `src/scene/materials.js` | Materiais físicos e injeção GLSL no PBR |
| `src/scene/Particles.js` | Amostragem da superfície e buffer das instâncias |
| `src/scene/Ocean.js` | IBL, iluminação, sedimentos e fundo do mar |
| `src/shaders/particles.js` | Movimento rígido, curl e formação do manifesto |
| `src/shaders/water.js` | Integração volumétrica, DOF e óptica |
| `src/ui/TitleWave.js` | Camada tipográfica em GLSL |
| `src/ui/Annotations.js` | Âncoras e conectores dos infográficos |
| `src/ui/Interface.js` | Navegação, diálogos, qualidade, som e acessibilidade |
| `src/style.css` | Direção de arte, layout responsivo e fallback |

Leia [ARCHITECTURE.md](ARCHITECTURE.md) para o pipeline, as equações e o contrato de assets.

## Substituir os assets

Em `src/config.js`, troque os valores `null` por caminhos relativos à raiz pública:

```js
assets: {
  fish: '/assets/models/pisces-electronica.glb',
  environment: '/assets/environment/underwater-studio.hdr',
  normal: '/assets/textures/corroded-metal-normal.webp',
  dracoDecoderPath: null
}
```

Coloque os arquivos nas pastas correspondentes em `public/assets/`. Há comentários e contratos em cada pasta. Use `null` para manter o equivalente procedural. O GLB deve ser composto por meshes rígidos separados, com eixo longitudinal X e transformações aplicadas. Skins precisam ser convertidos em geometria rígida antes da exportação.

## Perfis de qualidade

| Perfil | Partículas | DPR máximo | Passos volumétricos | DOF | Bloom |
| --- | ---: | ---: | ---: | --- | --- |
| Alta | 50.000 | 1,65 | 16 | Sim | Sim |
| Auto desktop | 24.000 | 1,25 | 10 | Reduzido | Sim |
| Leve / Auto mobile | 8.000 | 1 | 6 | Desligado | Não |

O controle inferior alterna Auto → Alta → Leve. Auto pode reduzir a qualidade após uma janela inicial de medições. A contagem máxima não é uma garantia de FPS: resolução, GPU, navegador, driver e assets mudam o custo. O modo de movimento reduzido elimina movimento autônomo, transições contínuas, grain e DOF; os capítulos permanecem navegáveis.

## Verificação

```sh
npm run check
npm run build
```

A validação adicional de GLSL usa um driver EGL/OpenGL ES 3 de sistema (Mesa no ambiente de desenvolvimento):

```sh
node scripts/shader-fixtures.mjs /tmp/aquarium-shaders.json
python3 scripts/validate-glsl.py /tmp/aquarium-shaders.json
```

Ela monta os programas usando o pré-processamento real do Three.js e compila/linka os shaders de PBR, partículas, água, filme, cáusticas, sedimentos e título. Também verifica os atributos das geometrias. Não substitui teste visual WebGL nem profiling em GPUs reais.

Nesta entrega, sintaxe, build, geometria e os sete programas GLSL passaram. Layout, navegação e diálogos foram revisados no navegador em modo de leitura. O navegador de teste não disponibilizou contexto WebGL, portanto a renderização WebGL integral, a aparência dinâmica do DOF e o desempenho em hardware real ainda exigem validação.

## Acabamento de produção

Esta é uma base executável, com arte procedural inicial. Fotorrealismo extremo depende do modelo final, materiais fotografados ou escaneados, HDR autoral, composição e direção de luz. As cáusticas são procedurais; o volume usa espalhamento simples; o fluido usa um campo analítico de curl. Não são path tracing, cáusticas refrativas resolvidas fisicamente ou uma simulação Navier–Stokes. O CTA usa vidro em CSS com backdrop blur.

Uma posição em premiações não pode ser garantida por arquitetura ou quantidade de efeitos. Para a fase de produção, priorize assets, direção de arte, perfil de desempenho e testes cruzados sobre adicionar passes sem uma finalidade visual.

## Poster da versão de leitura

`public/assets/aquarium-poster.webp` é um render offline da mesma geometria procedural. Só ocupa a cena quando WebGL não está disponível; não simula uma captura de renderização em tempo real. Para reproduzir o render, instale Blender 4.3 e execute:

```sh
node scripts/export-proxy.mjs /tmp/proxy.json
blender -b --threads 8 --python scripts/render-poster.py -- /tmp/proxy.json /tmp/aquarium-poster.png
```

O script salva também a cena Blender junto ao PNG. Converta o PNG para WebP com seu otimizador de imagens.

## Fontes e licenças

Os números se referem a resíduos eletrônicos globais de 2022, não ao volume nos oceanos. Fonte: [Global E-waste Monitor 2024 — ITU/UNITAR](https://ewastemonitor.info/the-global-e-waste-monitor-2024/). Partículas, profundidade e coordenadas são elementos narrativos, sem escala científica.

Referências de implementação: [Three.js](https://threejs.org/docs/), [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [integração oficial Lenis/GSAP](https://github.com/darkroomengineering/lenis#gsap-scrolltrigger). As versões estão fixadas em `package-lock.json`. Preserve e consulte as licenças das dependências, especialmente os termos do GSAP, antes de redistribuir bibliotecas. Modelos e mapas de terceiros devem ter licença adequada ao uso.
