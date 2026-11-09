# Arquitetura de renderização

O sistema tem uma coordenada narrativa: o scroll suavizado. Ele determina câmera, foco, desmonte, dissolução, dispersão e formação tipográfica. O tempo anima apenas flutuação, ondulações, sedimentos e escoamento local. Nenhuma etapa narrativa avança automaticamente.

## 1. Um relógio para a experiência

`ScrollDirector` registra o Lenis no ticker do GSAP, em milissegundos, e conecta o evento `scroll` a `ScrollTrigger.update`. `autoRaf` fica desativado. Não existe um segundo `requestAnimationFrame` competindo com o render.

```js
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => {
  lenis.raf(time * 1000);
  // Estado derivado da posição atual → um render da cena.
});
gsap.ticker.lagSmoothing(0);
```

Os limites das etapas derivam das posições reais dos elementos HTML. Resize recalcula esses limites e os intervalos dos pins. `smooth(a, b, scrollY)` evita depender de tweens cumulativos ou integrações físicas irreversíveis. Recuar o scroll recompõe as mesmas peças.

Os três capítulos posteriores à abertura fixam seus painéis com `ScrollTrigger.pin`, `anticipatePin` e espaçamento reservado pela altura das seções. A tela WebGL permanece fixa sob o conteúdo HTML. Teclado, touch e links de âncora usam o mesmo fluxo.

## 2. Geometria rígida na GPU

Na criação do peixe, os transforms de cada peça são aplicados aos vértices uma única vez. Cada vértice recebe:

| Atributo | Significado |
| --- | --- |
| `aPivot: vec3` | Centro rígido da peça |
| `aDirection: vec3` | Direção de afastamento |
| `aAxis: vec3` | Eixo normalizado de rotação |
| `aPhase: float` | Variação determinística de atraso/amplitude |

As geometrias com o mesmo material são unidas. O proxy resulta em 278 peças, mas apenas sete meshes de material. O custo de atualizar o progresso no JavaScript é constante em relação à quantidade de peças.

O shader calcula:

```glsl
float p = smoothstep(aPhase * 0.18, 1.0, uProgress);
vec3 transformed = aPivot + rotatePart(aAxis, p * (0.5 + aPhase))
                 * (position - aPivot);
transformed += aDirection * p * (2.8 + aPhase * 1.4);
```

A normal é rotacionada pela mesma matriz antes da transformação normal do Three.js. A iluminação física acompanha a orientação da peça; mover só a posição produziria reflexos incorretos. A flutuação final combina seno e cosseno, com maior amplitude na cauda.

A injeção usa `onBeforeCompile` de `MeshPhysicalMaterial`, preservando BRDF, mapas, clearcoat, iridescência e IBL. `customProgramCacheKey` identifica a variante. As referências dos uniforms são compartilhadas pelos sete materiais.

O descarte por dither dissolve a superfície opaca sem ordenar centenas de materiais transparentes. É uma transição artística; o shader não executa uma fratura física da topologia.

## 3. PBR e ambiente

Os sete materiais representam carcaça oxidada, metal escuro, cobre, PCB, cromo, vidro revestido e sensores emissivos. Os mapas iniciais de normal/rugosidade são `DataTexture` procedurais com micro-riscos. Seus dados ficam em `NoColorSpace`.

O ambiente autônomo é prefiltrado com PMREM a partir de uma sala de iluminação com tonalidade aquática. Ele fornece reflexos especulares aos metais. Um `RGBELoader` pode substituir essa origem por um HDR linear; o HDR original é descartado após a geração do PMREM.

Regras de gerenciamento de cor:

- Texturas de base color e emissive importadas via glTF: sRGB conforme o loader.
- Normal, roughness, metalness, AO e depth: dados, sem conversão sRGB.
- HDR e cálculos de luz: linear.
- Tone mapping ACES e conversão de saída: `OutputPass`, uma vez.
- Grain e aberração: depois da conversão de saída; são efeitos de imagem.

Não há screen-space reflection ou ray tracing na edição inicial. Os reflexos metálicos são IBL; o vidro do peixe usa clearcoat e iridescência. Transmission pode ser habilitada no material final com orçamento de renderização específico, após medir seu custo.

## 4. Pipeline do EffectComposer

A ordem é deliberada:

1. `RenderPass`: cena física em render target com depth texture.
2. `UnderwaterPass`: DOF com máscara de profundidade e volumetria com oclusão.
3. `UnrealBloomPass`: apenas highlights acima do limiar.
4. `OutputPass`: ACES e conversão para sRGB.
5. `FXAAShader`: anti-aliasing da imagem composta.
6. `FilmPass` próprio: aberração radial, vignette e grain sutil.
7. `TitleWave`: título sobreposto por uma segunda cena ortográfica, sem DOF.

O target usa HalfFloat quando `EXT_color_buffer_float` está disponível; há fallback para UnsignedByte. Os dois buffers do composer carregam depth textures. Não há MSAA adicional; FXAA evita o custo de combinar MSAA com uma cadeia de pós-processamento.

### Profundidade coerente

O `UnderwaterPass` recebe a profundidade do próprio `RenderPass`, depois que o vertex shader deslocou as peças. Não há um override material que desenhe o peixe ainda montado no buffer de profundidade.

O foco deriva de uma posição de interesse no peixe, transformada para espaço da câmera. Ao desmontar, o ponto avança para a região das peças em primeiro plano. A abertura tem 12 amostras distribuídas por ângulo áureo, com peso por profundidade para reduzir vazamento de fundo nas bordas. É DOF de tela aproximado; não resolve transparências multicamada nem um diafragma fisicamente completo.

### Volumetria e cáusticas

Cada pixel reconstrói sua posição a partir da depth texture e da inversa da projeção. O shader percorre o raio da câmera até a superfície mais próxima, com 6–16 passos. Uma cookie procedural define os feixes; a integração aplica extinção e uma aproximação direcional de espalhamento.

Isso produz feixes ocluídos pela geometria com custo limitado. Não é volumetria de múltiplo espalhamento. Para uma produção de maior orçamento, a evolução indicada é um buffer volumétrico de resolução reduzida, reprojeção temporal e filtragem bilateral, com rejeição de histórico em mudanças bruscas do scroll.

As cáusticas são padrões analíticos animados em coordenadas de superfície. Acrescentam modulação de luz ao fundo e às peças. Cáusticas fisicamente refratadas exigem uma simulação de superfície e um solver/render target de transporte de luz próprios; não estão sendo apresentadas como já resolvidas aqui.

## 5. Partículas e fluido

`Particles.sampleFish` constrói uma distribuição acumulada da área dos triângulos do peixe. Cada instância recebe um ponto da superfície por amostragem baricêntrica e os atributos rígidos da peça de origem. Assim, no início da dissolução, a origem das partículas acompanha o mesmo desmonte do PBR. Um GLB carregado com sucesso refaz essa amostragem uma vez.

A geometria é um quad instanciado; o shader controla posição, rotação, tamanho, cor e alpha. Um único `InstancedMesh` mantém até 50.000 instâncias. `instanceMatrix` é inicializada uma vez, sem `setMatrixAt` por frame. As posições variáveis existem em atributos e uniforms, não em buffers enviados a cada tick.

O campo é o curl analítico de um potencial vetorial trigonométrico:

```glsl
vec3 curl(vec3 p, float t) {
  return vec3(
    -sin(p.x+t)*sin(p.y) - cos(p.z+t)*cos(p.x),
    -sin(p.y+t)*sin(p.z) - cos(p.x+t)*cos(p.y),
    -sin(p.z+t)*sin(p.x) - cos(p.y+t)*cos(p.z)
  );
}
```

O curl de um potencial tem divergência nula. Esta implementação usa o campo para deslocamento visual direto; não integra velocidade, pressão, colisão ou conservação de massa em uma malha de fluido. A velocidade de scroll, filtrada e limitada, aumenta a agitação. Isso mantém a narrativa reversível e evita uma textura de estado que acumularia diferenças no rewind.

O destino do manifesto vem de uma máscara Canvas2D de texto. As mesmas partículas passam da superfície ao campo disperso e depois à tipografia. Os destinos finais são colocados no espaço da câmera, com escala calculada pelo FOV/aspect ratio, para que a frase caiba também em telas estreitas.

## 6. Infográficos e título

Apenas duas âncoras de peças são calculadas no CPU. Seus pivôs seguem a mesma função de progresso e deslocamento do shader, são projetados pela câmera e ligados aos rótulos por SVG. Isso não reintroduz uma atualização por peça.

O título acessível é HTML. A linha contornada é rasterizada em CanvasTexture e distorcida em um fragment shader com ondas de baixa amplitude. O shader ocupa exatamente o retângulo do título no layout. Movimento reduzido e ausência de WebGL preservam o texto DOM.

## 7. Contrato do GLB

Para substituir o proxy:

- Use eixo longitudinal X, cabeça voltada a +X, Y para cima e Z como largura.
- Aplique escala/rotação no DCC e use coordenadas próximas da origem.
- Exporte meshes rígidos separados para cada conjunto que deve se desprender.
- Preserve grupos de material e tangentes quando houver normal maps que precisem delas.
- Evite skins e morph targets no contrato atual. O loader rejeita skins para não prometer uma deformação rígida incorreta.
- Mantenha UVs válidos e materiais glTF metallic-roughness.
- Use nomes como `copper`, `circuit` e `armor` para âncoras editoriais previsíveis.
- Comece com mapas de até 2K; meça antes de subir a resolução.

O loader aplica transformações de mundo e centraliza o conjunto, normalizando o comprimento para 5,8 unidades. Cada mesh recebe atributos rígidos e um clone de seu material com a mesma injeção GLSL. A versão inicial faz batching do proxy; o GLB preserva seus meshes/material groups. Faça batching por material no pipeline de produção se o número de chamadas de desenho exceder o orçamento.

Não existe um arquivo HDR ou GLB fotorrealista fictício no projeto: os campos ficam explicitamente `null` e o proxy completo continua funcionando. DRACO é opcional e requer decoders compatíveis na pasta configurada. KTX2/Basis não é inicializado automaticamente; se adotado, configure `KTX2Loader.detectSupport(renderer)` e os transcoders locais antes do carregamento.

## 8. Memória, recuperação e acessibilidade

`Resources` possui sets de recursos para evitar descarte duplicado de mapas compartilhados. O encerramento:

1. Interrompe ticker, Lenis e pins.
2. Aborta listeners e impede adoção de assets assíncronos após o descarte.
3. Remove overlays e fecha nós de áudio.
4. Descarta geometrias, materiais, texturas, passes e os targets do composer.
5. Libera render lists, renderer e contexto.

O evento `pagehide` preserva a instância no bfcache e libera recursos em navegação real. HMR também faz teardown. Uma aba oculta interrompe trabalho de renderização; o áudio é suspenso. Perda de contexto apresenta leitura com poster; restauração recarrega a aplicação. Falha em um asset opcional mantém a edição procedural.

A versão de leitura usa um poster offline da mesma geometria, títulos e textos HTML, navegação nativa, diálogos e links de ação. Não tenta imitar interatividade 3D com um vídeo. Som é sempre opt-in. O sistema respeita `prefers-reduced-motion` e oferece um controle adicional no diálogo de informações.

## 9. O que validar antes de produção

A verificação desta entrega cobre build, sintaxe, atributos e compilação/linkagem dos sete programas GLSL por EGL/OpenGL ES 3. O navegador disponível bloqueou WebGL: sua revisão visual se limitou ao fallback, layout, navegação e diálogos. Portanto, ainda é necessário verificar a cena completa em navegadores com WebGL2.

A próxima rodada deve medir frame time de CPU/GPU, preenchimento do buffer, draw calls e consumo de memória em uma GPU desktop e em celulares representativos. Use a versão de produção, não o servidor de desenvolvimento. Teste ida e volta no scroll, resize/orientação, troca de qualidade, foco dos diálogos, abas em background e perda/restauração de contexto.

O acabamento fotográfico final exige assets de produção e revisão de cor/luz. Nenhuma pontuação, posição em prêmio ou FPS mínimo universal é presumido por este código.
