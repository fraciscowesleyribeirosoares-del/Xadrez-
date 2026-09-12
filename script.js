// --- CONFIGURAÇÃO DO JOGO ---
const game = new Chess();
let playerColor = 'w'; // 'w' para brancas, 'b' para pretas
let selectedSquare = null;
let boardMeshGroup = new THREE.Group();
let piecesGroup = new THREE.Group();
let highlightedSquares = [];
let isAnimating = false;

const pieceValues = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

// --- CONFIGURAÇÃO 3D (THREE.JS) ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();

const skyGeo = new THREE.SphereGeometry(90, 32, 15);
const skyMat = new THREE.ShaderMaterial({
    uniforms: {
        topColor: { value: new THREE.Color(0x0a0c12) },
        bottomColor: { value: new THREE.Color(0x1a233a) }
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
            float h = normalize(vWorldPosition).y;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
    `,
    side: THREE.BackSide
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

scene.fog = new THREE.FogExp2(0x0a0c12, 0.02);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 5;
controls.maxDistance = 18;

// Ajusta a posição da câmera de acordo com a cor do jogador
function updateCameraPosition() {
    if (playerColor === 'w') {
        camera.position.set(0, 8.5, 9.5);
    } else {
        camera.position.set(0, 8.5, -9.5);
    }
    controls.target.set(0, 0, 0);
    controls.update();
}

// --- ILUMINAÇÃO DE ESTÚDIO ---
const ambientLight = new THREE.AmbientLight(0xdbe3ff, 0.5);
scene.add(ambientLight);

const keyLight = new THREE.SpotLight(0xfff0dd, 2.5);
keyLight.position.set(6, 12, 6);
keyLight.angle = Math.PI / 3;
keyLight.penumbra = 0.4;
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.bias = -0.0001;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x00d2ff, 1.2);
rimLight.position.set(-8, 8, -8);
scene.add(rimLight);

// MATERIAIS
const studioFloorMat = new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 0.1, metalness: 0.2 });
const tableMat = new THREE.MeshStandardMaterial({ color: 0x121622, roughness: 0.2, metalness: 0.3 });
const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0x00f5d4, roughness: 0.1, metalness: 0.9, emissive: 0x004d40, emissiveIntensity: 0.2 });

const lightSquareMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.05 });
const darkSquareMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2, metalness: 0.2 });

const whitePieceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, metalness: 0.1 });
const blackPieceMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.4 });

const highlightMat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.6 });

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function createStudioScenario() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), studioFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    scene.add(floor);

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 11), tableMat);
    tableTop.position.set(0, -0.16, 0);
    tableTop.receiveShadow = true;
    scene.add(tableTop);

    const glowRing = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.05, 11.2), goldTrimMat);
    glowRing.position.set(0, -0.2, 0);
    scene.add(glowRing);
}

scene.add(boardMeshGroup);
scene.add(piecesGroup);

function createBoard() {
    boardMeshGroup.clear();
    const squareGeo = new THREE.BoxGeometry(1, 0.1, 1);
    
    for (let col = 0; col < 8; col++) {
        for (let row = 0; row < 8; row++) {
            const isLight = (col + row) % 2 === 0;
            const tile = new THREE.Mesh(
                squareGeo, 
                isLight ? lightSquareMat : darkSquareMat
            );
            tile.position.set(col - 3.5, 0, row - 3.5);
            tile.receiveShadow = true;
            tile.userData = { square: coordsToSquare(col, row) };
            boardMeshGroup.add(tile);
        }
    }
}

function createPieceGeometry(type) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.1, 24));
    base.position.y = 0.1;
    group.add(base);

    switch (type.toLowerCase()) {
        case 'p': {
            const body = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.35, 20));
            body.position.y = 0.31;
            const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.05, 20));
            collar.position.y = 0.47;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 20));
            head.position.y = 0.59;
            group.add(body, collar, head);
            break;
        }
        case 'r': {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.48, 20));
            body.position.y = 0.38;
            const topRing = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.24, 0.15, 20));
            topRing.position.y = 0.68;
            for (let i = 0; i < 4; i++) {
                const battlement = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1));
                const angle = (i * Math.PI) / 2;
                battlement.position.set(Math.cos(angle) * 0.2, 0.76, Math.sin(angle) * 0.2);
                group.add(battlement);
            }
            group.add(body, topRing);
            break;
        }
        case 'n': {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.3, 20));
            body.position.y = 0.29;
            const chest = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16));
            chest.scale.set(0.8, 1.2, 1.1);
            chest.position.set(0, 0.51, 0.05);
            const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.3));
            snout.position.set(0, 0.61, 0.15);
            snout.rotation.x = 0.35;
            group.add(body, chest, snout);
            break;
        }
        case 'b': {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.28, 0.45, 20));
            body.position.y = 0.37;
            const ringMid = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.06, 20));
            ringMid.position.y = 0.61;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 20));
            head.scale.set(1, 1.35, 1);
            head.position.y = 0.75;
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12));
            orb.position.y = 0.96;
            group.add(body, ringMid, head, orb);
            break;
        }
        case 'q': {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 0.6, 20));
            body.position.y = 0.44;
            const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.08, 20));
            collar.position.y = 0.75;
            const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.18, 16));
            crown.position.y = 0.87;
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12));
            orb.position.y = 1.0;
            group.add(body, collar, crown, orb);
            break;
        }
        case 'k': {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.65, 20));
            body.position.y = 0.46;
            const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.08, 20));
            collar.position.y = 0.79;
            const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.2, 16));
            crown.position.y = 0.91;
            const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06));
            crossV.position.y = 1.08;
            const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.06));
            crossH.position.y = 1.1;
            group.add(body, collar, crown, crossV, crossH);
            break;
        }
    }

    group.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return group;
}

function renderPieces() {
    while (piecesGroup.children.length > 0) {
        piecesGroup.remove(piecesGroup.children[0]);
    }

    const board = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                const group = createPieceGeometry(piece.type);
                const mat = piece.color === 'w' ? whitePieceMat : blackPieceMat;
                
                group.traverse((child) => {
                    if (child.isMesh) child.material = mat;
                });

                const pos = coordsToVector(c, r);
                group.position.set(pos.x, 0.05, pos.z);
                
                // Rotaciona o cavalo para encarar o oponente correto
                if (piece.type === 'n') {
                    group.rotation.y = piece.color === 'w' ? 0 : Math.PI;
                }
                
                const squareName = coordsToSquare(c, r);
                group.userData = { square: squareName };
                
                piecesGroup.add(group);
            }
        }
    }
}

// --- CONTROLES E CLIQUE ---
function coordsToSquare(col, row) {
    return ['a','b','c','d','e','f','g','h'][col] + (8 - row);
}

function squareToCoords(square) {
    return { col: square.charCodeAt(0) - 97, row: 8 - parseInt(square[1]) };
}

function coordsToVector(col, row) {
    return new THREE.Vector3(col - 3.5, 0, row - 3.5);
}

window.addEventListener('pointerdown', onPointerDown);

function onPointerDown(event) {
    if (isAnimating || game.turn() !== playerColor || game.game_over()) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects([...boardMeshGroup.children, ...piecesGroup.children], true);

    if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        while (hitObj && !hitObj.userData.square && hitObj.parent) {
            hitObj = hitObj.parent;
        }

        const clickedSquare = hitObj ? hitObj.userData.square : null;
        if (!clickedSquare) return;

        if (selectedSquare === null) {
            const piece = game.get(clickedSquare);
            if (piece && piece.color === playerColor) {
                selectedSquare = clickedSquare;
                highlightMoves(selectedSquare);
            }
        } else {
            const move = game.move({ from: selectedSquare, to: clickedSquare, promotion: 'q' });

            clearHighlights();
            const previousSquare = selectedSquare;
            selectedSquare = null;

            if (move !== null) {
                renderPieces();
                updateStatus();
                setTimeout(makeAIMove, 300);
            } else {
                const piece = game.get(clickedSquare);
                if (piece && piece.color === playerColor && clickedSquare !== previousSquare) {
                    selectedSquare = clickedSquare;
                    highlightMoves(selectedSquare);
                }
            }
        }
    }
}

function highlightMoves(square) {
    clearHighlights();
    const moves = game.moves({ square: square, verbose: true });
    moves.forEach(move => {
        const coords = squareToCoords(move.to);
        const mesh = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.4, 24), highlightMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(coords.col - 3.5, 0.06, coords.row - 3.5);
        scene.add(mesh);
        highlightedSquares.push(mesh);
    });
}

function clearHighlights() {
    highlightedSquares.forEach(m => scene.remove(m));
    highlightedSquares = [];
}

// --- IA DE XADREZ ---
function makeAIMove() {
    if (game.game_over() || game.turn() === playerColor) return;

    const difficulty = document.getElementById('difficulty').value;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;

    let selectedMove = null;

    if (difficulty === 'easy') {
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
    } else if (difficulty === 'medium') {
        moves.sort((a, b) => (b.captured ? pieceValues[b.captured] : 0) - (a.captured ? pieceValues[a.captured] : 0));
        selectedMove = moves[0];
    } else if (difficulty === 'hard') {
        let bestScore = -Infinity;
        for (let move of moves) {
            game.move(move);
            let score = minimax(2, false, -Infinity, Infinity);
            game.undo();
            if (score > bestScore) {
                bestScore = score;
                selectedMove = move;
            }
        }
    }

    if (selectedMove) {
        game.move(selectedMove);
        renderPieces();
        updateStatus();
    }
}

function minimax(depth, isMaximizing, alpha, beta) {
    if (depth === 0 || game.game_over()) return evaluateBoard(game.board());
    const moves = game.moves();

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (let move of moves) {
            game.move(move);
            let evaluation = minimax(depth - 1, false, alpha, beta);
            game.undo();
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let move of moves) {
            game.move(move);
            let evaluation = minimax(depth - 1, true, alpha, beta);
            game.undo();
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function evaluateBoard(board) {
    let score = 0;
    const aiColor = playerColor === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                const val = pieceValues[piece.type];
                score += piece.color === aiColor ? val : -val;
            }
        }
    }
    return score;
}

function updateStatus() {
    const statusEl = document.getElementById('status');
    if (game.in_checkmate()) {
        statusEl.innerText = game.turn() === playerColor ? 'IA Venceu!' : 'Você Venceu!';
    } else if (game.in_draw()) {
        statusEl.innerText = 'Empate!';
    } else {
        statusEl.innerText = game.turn() === playerColor ? 'Sua vez' : 'IA pensando...';
        if (game.in_check()) statusEl.innerText += ' (Xeque!)';
    }
}

function resetGame() {
    game.reset();
    clearHighlights();
    selectedSquare = null;
    updateCameraPosition();
    renderPieces();
    updateStatus();

    // Se o jogador escolher as pretas, a IA faz a primeira jogada
    if (playerColor === 'b') {
        setTimeout(makeAIMove, 500);
    }
}

// BOTOES DE TROCA DE COR
const btnWhite = document.getElementById('btn-white');
const btnBlack = document.getElementById('btn-black');

btnWhite.addEventListener('click', () => {
    playerColor = 'w';
    btnWhite.classList.add('btn-active');
    btnBlack.classList.remove('btn-active');
    resetGame();
});

btnBlack.addEventListener('click', () => {
    playerColor = 'b';
    btnBlack.classList.add('btn-active');
    btnWhite.classList.remove('btn-active');
    resetGame();
});

document.getElementById('reset-btn').addEventListener('click', resetGame);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// INICIALIZAR
createStudioScenario();
createBoard();
updateCameraPosition();
renderPieces();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
