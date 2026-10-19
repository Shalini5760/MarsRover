/* =========================================================================
   MISSION MARS: REAL 3D ENGINE & ROVER RESCUE CONTROLLER
   Built with WebGL & Three.js
   ========================================================================= */

let playerName = "";

let game = {
    running: false,
    mission: 1,
    score: 0,
    samples: 0,
    battery: 100,
    oxygen: 100,
    time: 0
};

// Rover State with Real 3D Orientation and Velocities
let rover = {
    x: -30,
    z: 22,
    angle: 0,
    speed: 0,
    maxSpeed: 0.48,
    accel: 0.06,
    friction: 0.8,
    turnSpeed: 0.042,
    size: 2.2
};

let keys = {};
let timerInterval;
let animationFrame;

// Arena dimensions in 3D world units
const WORLD_WIDTH = 90;
const WORLD_HEIGHT = 56;

function terrainHeightAt(x, z) {
    const planeY = -z;
    const dunes = Math.sin(x * 0.035 + Math.sin(planeY * 0.025)) *
        Math.cos(planeY * 0.045 - x * 0.018) * 2;
    const ripples = Math.sin(x * 0.22 + Math.sin(planeY * 0.14)) *
        Math.cos(planeY * 0.19) * 0.8;
    const roughness = Math.sin(x * 0.52) * Math.cos(planeY * 0.47) * 0.3;
    return dunes + ripples + roughness;
}

let obstacles = [];
let samples = [];
let dustStorm = null;
let communicationStation = null;
let suggestedPath = [];
let currentDiscovery = null;
let cameraMode = "tactical"; // "tactical" (high 3D angle) or "chase" (behind rover)

// Three.js 3D Engine Globals
let scene3D, camera3D, renderer3D;
let rover3DGroup, roverMast3D, roverArm3D, roverWheels3D = [];
let sample3DMeshes = [];
let obstacle3DMeshes = [];
let commsStation3D = null;
let dustStorm3DMesh = null;
let aiPath3DLine = null;
let dustParticles3D = null;

const discoveries = [
    {
        title: "Volcanic Basalt",
        category: "IGNEOUS ROCK",
        visual: "fragment",
        color: 0xe78252,
        cssColor: "#e78252",
        text: "Dark vesicular volcanic basalt formed when ancient Elysium lava fields cooled. Grain analysis marks volcanic activity eras."
    },
    {
        title: "Water-Ice Vein",
        category: "WATER ICE",
        visual: "shard",
        color: 0x71dfff,
        cssColor: "#71dfff",
        text: "Pristine sub-surface glacial ice crystal. Critical for analyzing past water cycles and potential in-situ rocket fuel generation."
    },
    {
        title: "Clay-Rich Soil",
        category: "ANCIENT WATER",
        visual: "layered",
        color: 0xdca568,
        cssColor: "#dca568",
        text: "Phyllosilicates formed under sustained standing liquid water billions of years ago in a neutral, life-friendly environment."
    },
    {
        title: "Hematite Spherules",
        category: "IRON MINERAL",
        visual: "sphere",
        color: 0xd87563,
        cssColor: "#d87563",
        text: "Martian 'blueberries' - spherical hematite concretions precipitated from ancient mineral-saturated groundwater flow."
    },
    {
        title: "Olivine Crystals",
        category: "MINERAL GRAINS",
        visual: "cluster",
        color: 0xb8d879,
        cssColor: "#b8d879",
        text: "Ultramafic magnesium-iron silicate crystals preserved without water erosion, providing a window into Mars mantle composition."
    },
    {
        title: "Subsurface Brine Trace",
        category: "SALT CRUST",
        visual: "shard",
        color: 0x9be0cb,
        cssColor: "#9be0cb",
        text: "Hydrated perchlorate salt crystals lowering the freezing point of sub-surface liquids. Prime target for follow-up testing."
    }
];

/* -------------------------------------------------------------------------
   INPUT LISTENERS
   ------------------------------------------------------------------------- */
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && game.running) {
        quitMission();
        return;
    }
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d", " "].includes(k)) {
        e.preventDefault();
    }
    keys[k] = true;
});

document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    keys = {};
});

document.querySelectorAll(".drive-controls button").forEach(button => {
    const keyMap = {
        arrowup: "w",
        arrowdown: "s",
        arrowleft: "a",
        arrowright: "d"
    };
    const mapped = keyMap[button.dataset.key];

    button.addEventListener("pointerdown", event => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        keys[mapped] = true;
    });
    button.addEventListener("pointerup", () => { keys[mapped] = false; });
    button.addEventListener("pointercancel", () => { keys[mapped] = false; });
    button.addEventListener("lostpointercapture", () => { keys[mapped] = false; });
});

function toggleCameraMode() {
    cameraMode = cameraMode === "tactical" ? "chase" : "tactical";
    const btn = document.getElementById("cameraToggleBtn");
    if (btn) btn.innerText = cameraMode === "tactical" ? "VIEW: TACTICAL 3D" : "VIEW: CHASE CAM";
}

/* -------------------------------------------------------------------------
   THREE.JS 3D WORLD BUILDER
   ------------------------------------------------------------------------- */
function init3DWorld() {
    const container = document.getElementById("game3dContainer");
    if (!container || scene3D) return;

    // 1. Scene & Fog
    scene3D = new THREE.Scene();
    scene3D.background = new THREE.Color(0x39343a);
    scene3D.fog = new THREE.Fog(0x39343a, 70, 190);

    // 2. Camera setup
    camera3D = new THREE.PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.5, 700);
    camera3D.position.set(0, 34, 30);
    camera3D.lookAt(0, 0, 0);

    // 3. Renderer with antialiasing and shadow maps
    renderer3D = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer3D.setClearColor(0x39343a, 1);
    renderer3D.setSize(container.clientWidth, container.clientHeight);
    renderer3D.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer3D.outputEncoding = THREE.sRGBEncoding;
    renderer3D.toneMapping = THREE.ACESFilmicToneMapping;
    renderer3D.toneMappingExposure = 0.85;
    renderer3D.shadowMap.enabled = true;
    renderer3D.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer3D.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xdac4b2, 0.42);
    scene3D.add(ambientLight);

    const marsSun = new THREE.DirectionalLight(0xffd0a8, 0.72);
    marsSun.position.set(40, 60, 30);
    marsSun.castShadow = true;
    marsSun.shadow.mapSize.width = 2048;
    marsSun.shadow.mapSize.height = 2048;
    marsSun.shadow.camera.near = 10;
    marsSun.shadow.camera.far = 160;
    const d = 55;
    marsSun.shadow.camera.left = -d;
    marsSun.shadow.camera.right = d;
    marsSun.shadow.camera.top = d;
    marsSun.shadow.camera.bottom = -d;
    scene3D.add(marsSun);

    const blueRimLight = new THREE.DirectionalLight(0x7798bd, 0.18);
    blueRimLight.position.set(-30, 20, -40);
    scene3D.add(blueRimLight);

    // 5. 3D Terrain Bed
    const terrainGeo = new THREE.PlaneGeometry(500, 500, 220, 220);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        pos.setZ(i, terrainHeightAt(vx, -vy));
    }
    terrainGeo.computeVertexNormals();
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 512;
    textureCanvas.height = 512;
    const textureContext = textureCanvas.getContext("2d");
    const texturePixels = textureContext.createImageData(512, 512);
    for (let i = 0; i < texturePixels.data.length; i += 4) {
        const grain = Math.random() * 30 - 15;
        texturePixels.data[i] = 126 + grain;
        texturePixels.data[i + 1] = 71 + grain * 0.7;
        texturePixels.data[i + 2] = 49 + grain * 0.55;
        texturePixels.data[i + 3] = 255;
    }
    textureContext.putImageData(texturePixels, 0, 0);
    for (let i = 0; i < 420; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = 1 + Math.random() * 8;
        textureContext.fillStyle = Math.random() > 0.5
            ? "rgba(207, 139, 94, 0.08)"
            : "rgba(22, 17, 18, 0.12)";
        textureContext.beginPath();
        textureContext.ellipse(x, y, radius * 1.5, radius, Math.random() * Math.PI, 0, Math.PI * 2);
        textureContext.fill();
    }
    const terrainTexture = new THREE.CanvasTexture(textureCanvas);
    terrainTexture.encoding = THREE.sRGBEncoding;
    terrainTexture.wrapS = THREE.RepeatWrapping;
    terrainTexture.wrapT = THREE.RepeatWrapping;
    terrainTexture.repeat.set(14, 14);
    const terrainMat = new THREE.MeshStandardMaterial({
        map: terrainTexture,
        roughness: 1,
        metalness: 0
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -0.05;
    terrain.receiveShadow = true;
    scene3D.add(terrain);

    // Subtle Grid Wire on Terrain
    const gridHelper = new THREE.GridHelper(180, 36, 0x887064, 0x75635b);
    gridHelper.position.y = 0.02;
    gridHelper.material.opacity = 0.035;
    gridHelper.material.transparent = true;
    scene3D.add(gridHelper);

    const pebbleGeometry = new THREE.DodecahedronGeometry(1, 0);
    const pebbleMaterial = new THREE.MeshStandardMaterial({
        color: 0x49332b,
        roughness: 1,
        flatShading: true
    });
    const pebbles = new THREE.InstancedMesh(pebbleGeometry, pebbleMaterial, 260);
    const pebbleTransform = new THREE.Object3D();
    for (let i = 0; i < pebbles.count; i++) {
        const x = (Math.random() - 0.5) * WORLD_WIDTH * 1.2;
        const z = (Math.random() - 0.5) * WORLD_HEIGHT * 1.4;
        const size = 0.08 + Math.random() * 0.28;
        pebbleTransform.position.set(
            x,
            terrainHeightAt(x, z) + size * 0.35,
            z
        );
        pebbleTransform.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
        pebbleTransform.scale.set(size * 1.4, size, size);
        pebbleTransform.updateMatrix();
        pebbles.setMatrixAt(i, pebbleTransform.matrix);
    }
    pebbles.receiveShadow = true;
    scene3D.add(pebbles);

    // 6. Build the 3D ARES-07 Rover
    create3DRoverModel();

    // 7. Atmospheric Dust Particles
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustCoords = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount * 3; i += 3) {
        dustCoords[i] = (Math.random() - 0.5) * WORLD_WIDTH;
        dustCoords[i + 1] = Math.random() * 12 + 0.5;
        dustCoords[i + 2] = (Math.random() - 0.5) * WORLD_HEIGHT;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustCoords, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xb87956,
        size: 0.14,
        transparent: true,
        opacity: 0.22
    });
    dustParticles3D = new THREE.Points(dustGeo, dustMat);
    scene3D.add(dustParticles3D);

    // Window resize handler
    window.addEventListener("resize", () => {
        if (!container.clientWidth || !container.clientHeight) return;
        camera3D.aspect = container.clientWidth / container.clientHeight;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(container.clientWidth, container.clientHeight);
    });
}

/* -------------------------------------------------------------------------
   CREATE HIGH DETAIL 3D ARES-07 ROVER
   ------------------------------------------------------------------------- */
function create3DRoverModel() {
    rover3DGroup = new THREE.Group();
    rover3DGroup.scale.setScalar(1.5);

    // Body Chassis Materials
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1d2127, metalness: 0.85, roughness: 0.35 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3b424e, metalness: 0.9, roughness: 0.25 });
    const neonOrange = new THREE.MeshBasicMaterial({ color: 0xff6611 });
    const cyanLight = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    // Central Chassis Hull
    const hullGeo = new THREE.BoxGeometry(2.2, 0.75, 3.2);
    const hull = new THREE.Mesh(hullGeo, chassisMat);
    hull.position.y = 1.05;
    hull.castShadow = true;
    hull.receiveShadow = true;
    rover3DGroup.add(hull);

    // Upper Avionics Pod
    const podGeo = new THREE.BoxGeometry(1.6, 0.45, 1.8);
    const pod = new THREE.Mesh(podGeo, armorMat);
    pod.position.set(0, 1.55, -0.2);
    pod.castShadow = true;
    rover3DGroup.add(pod);

    // Neon Accent Trim Stripes
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.08, 3.24), neonOrange);
    stripe.position.y = 1.05;
    rover3DGroup.add(stripe);

    // Solar Wings Left & Right
    const solarMat = new THREE.MeshStandardMaterial({ color: 0x09213d, metalness: 0.9, roughness: 0.15 });
    const wingLeft = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.8), solarMat);
    wingLeft.position.set(-1.6, 1.3, 0);
    wingLeft.rotation.z = -0.12;
    wingLeft.castShadow = true;

    const wingRight = wingLeft.clone();
    wingRight.position.x = 1.6;
    wingRight.rotation.z = 0.12;
    rover3DGroup.add(wingLeft);
    rover3DGroup.add(wingRight);

    // Sensor Mast Turret
    const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1), chassisMat);
    mastPole.position.set(0, 1.9, 0.9);
    mastPole.castShadow = true;
    rover3DGroup.add(mastPole);

    roverMast3D = new THREE.Group();
    roverMast3D.position.set(0, 2.45, 0.9);

    const cameraBox = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.45), armorMat);
    const eyeLens = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 16), cyanLight);
    eyeLens.rotation.x = Math.PI / 2;
    eyeLens.position.set(0.12, 0, 0.25);
    const antennaDish = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.2, 16, 1, true), chassisMat);
    antennaDish.rotation.x = -Math.PI / 2.2;
    antennaDish.position.set(-0.25, 0.15, 0.1);

    roverMast3D.add(cameraBox);
    roverMast3D.add(eyeLens);
    roverMast3D.add(antennaDish);
    rover3DGroup.add(roverMast3D);

    const noseMarker = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 0.85, 3),
        new THREE.MeshBasicMaterial({ color: 0x55f1ff })
    );
    noseMarker.rotation.x = Math.PI / 2;
    noseMarker.position.set(0, 1.08, 1.82);
    rover3DGroup.add(noseMarker);

    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xb8fbff });
    [-0.62, 0.62].forEach(x => {
        const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), headlightMaterial);
        headlight.position.set(x, 0.95, 1.58);
        rover3DGroup.add(headlight);
    });

    const rearLightMaterial = new THREE.MeshBasicMaterial({ color: 0xff4b46 });
    [-0.58, 0.58].forEach(x => {
        const rearLight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.1), rearLightMaterial);
        rearLight.position.set(x, 1.12, -1.62);
        rover3DGroup.add(rearLight);
    });

    // Articulated Specimen Retrieval Arm
    roverArm3D = new THREE.Group();
    roverArm3D.position.set(0.65, 1.3, -1.1);

    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8), armorMat);
    b1.position.set(0, 0.4, 0);
    b1.rotation.x = 0.5;

    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7), armorMat);
    b2.position.set(0, 0.9, -0.3);
    b2.rotation.x = -0.7;

    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.25), neonOrange);
    claw.position.set(0, 1.1, -0.6);

    roverArm3D.add(b1);
    roverArm3D.add(b2);
    roverArm3D.add(claw);
    rover3DGroup.add(roverArm3D);

    // 6 Big Suspension Wheels with Neon Rims
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.88 });
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xff6b1a });

    const wheelOffsets = [
        [-1.4, 0.46, -1.1], [1.4, 0.46, -1.1],
        [-1.48, 0.46, 0],   [1.48, 0.46, 0],
        [-1.4, 0.46, 1.1],  [1.4, 0.46, 1.1]
    ];

    roverWheels3D = [];
    wheelOffsets.forEach(pt => {
        const wGroup = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.4, 20), tireMat);
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;

        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 20), rimMat);
        rim.rotation.y = Math.PI / 2;
        rim.position.x = pt[0] > 0 ? 0.21 : -0.21;

        wGroup.add(tire);
        wGroup.add(rim);
        wGroup.position.set(pt[0], pt[1], pt[2]);
        rover3DGroup.add(wGroup);
        roverWheels3D.push(wGroup);
    });

    scene3D.add(rover3DGroup);
}

/* -------------------------------------------------------------------------
   SCREEN NAVIGATION & FLOW
   ------------------------------------------------------------------------- */
function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
    const background = document.querySelector(".background");
    background?.classList.toggle("game-playing", id === "gameScreen");
    background?.classList.toggle("home-screen-active", id === "homeScreen");
}

function showHome() {
    stopGame();
    showScreen("homeScreen");
}

function showInstructions() {
    showScreen("instructionScreen");
}

function showNameScreen() {
    showScreen("nameScreen");
}

function startGame() {
    playerName = document.getElementById("playerName").value.trim() || "Explorer";
    game.mission = 1;
    game.score = 0;
    initializeMission();
    showScreen("gameScreen");

    // Initialize 3D Engine on first entry
    setTimeout(() => {
        init3DWorld();
        buildMission3DObjects();
        startGameLoop();
    }, 60);
}

function initializeMission() {
    game.running = true;
    keys = {};
    game.samples = 0;
    game.battery = 100;
    game.oxygen = 100;
    game.time = 0;
    suggestedPath = [];
    currentDiscovery = null;

    document.getElementById("discoveryBox").innerHTML = `
        <div class="discovery-empty">
            <span class="specimen-visual specimen-shard" aria-hidden="true"><i></i><i></i><i></i></span>
            <strong>Field Journal Ready</strong>
            <span>Recover a sample to reveal its 3D scan and science telemetry.</span>
        </div>
    `;

    rover.x = -32;
    rover.z = 18;
    rover.angle = Math.PI;
    rover.speed = 0;

    createMissionData();
    updateUI();
}

/* -------------------------------------------------------------------------
   MISSION CONTENT & HAZARD GENERATION
   ------------------------------------------------------------------------- */
function createMissionData() {
    obstacles = [
        { x: -18, z: -12, w: 14, d: 8, h: 5.5, rot: 0.15 },
        { x: 4, z: -6, w: 16, d: 7, h: 4.8, rot: -0.2 },
        { x: 22, z: 2, w: 9, d: 16, h: 6.2, rot: 0.35 },
        { x: -14, z: 12, w: 15, d: 8, h: 4.5, rot: -0.1 },
        { x: 14, z: 18, w: 12, d: 9, h: 5.0, rot: 0.22 }
    ];

    communicationStation = {
        x: 34,
        z: -18,
        radius: 3.2
    };

    const requiredSamples = game.mission === 1 ? 3 : game.mission === 2 ? 4 : 5;

    // Shuffle discoveries
    const missionDiscoveries = discoveries.slice().sort(() => Math.random() - 0.5);

    samples = [];
    for (let i = 0; i < requiredSamples; i++) {
        let pos;
        let attempts = 0;
        if (i === 0) {
            pos = { x: -38, z: 18 };
        } else {
            do {
                pos = {
                    x: (Math.random() - 0.5) * (WORLD_WIDTH - 20),
                    z: (Math.random() - 0.5) * (WORLD_HEIGHT - 16)
                };
                attempts++;
            } while (attempts < 100 && (isCollidingWithObstacle(pos.x, pos.z, 5) || Math.hypot(pos.x - rover.x, pos.z - rover.z) < 14));
        }

        samples.push({
            id: i,
            x: pos.x,
            z: pos.z,
            collected: false,
            discovery: missionDiscoveries[i % missionDiscoveries.length]
        });
    }

    dustStorm = (game.mission >= 2) ? { x: 0, z: -5, radius: 14 } : null;
}

/* -------------------------------------------------------------------------
   SPAWN 3D MESHES IN THREE.JS SCENE
   ------------------------------------------------------------------------- */
function buildMission3DObjects() {
    if (!scene3D) return;

    // Clear previous meshes
    obstacle3DMeshes.forEach(m => scene3D.remove(m));
    sample3DMeshes.forEach(m => scene3D.remove(m));
    if (commsStation3D) scene3D.remove(commsStation3D);
    if (dustStorm3DMesh) scene3D.remove(dustStorm3DMesh);
    if (aiPath3DLine) scene3D.remove(aiPath3DLine);

    obstacle3DMeshes = [];
    sample3DMeshes = [];

    // 1. Rock Formation Obstacles (Beveled Low-Poly Martian Boulders)
    const rockMat = new THREE.MeshStandardMaterial({
        color: 0x39251f,
        roughness: 0.9,
        metalness: 0.02,
        flatShading: true
    });

    obstacles.forEach((obs, index) => {
        const geo = new THREE.DodecahedronGeometry(obs.w * 0.45, 1);
        const material = rockMat.clone();
        material.color.offsetHSL(0, 0, (index % 3 - 1) * 0.07);
        const mesh = new THREE.Mesh(geo, material);
        mesh.scale.set(1.1, (obs.h * 0.5) / (obs.w * 0.45), obs.d / (obs.w * 0.45));
        mesh.position.set(obs.x, terrainHeightAt(obs.x, obs.z) + obs.h * 0.5, obs.z);
        mesh.rotation.y = obs.rot;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene3D.add(mesh);
        obstacle3DMeshes.push(mesh);
    });

    // 2. Glowing Crystal Samples
    samples.forEach(s => {
        const group = new THREE.Group();
        group.position.set(s.x, terrainHeightAt(s.x, s.z) + 0.9, s.z);

        const crystalGeo = new THREE.OctahedronGeometry(1.0, 0);
        const crystalMat = new THREE.MeshStandardMaterial({
            color: 0x65e8ff,
            emissive: 0x65e8ff,
            emissiveIntensity: 1.4,
            roughness: 0.2,
            metalness: 0.9
        });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.scale.set(1.2, 2, 1.2);
        crystal.castShadow = true;
        group.add(crystal);

        const beacon = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.5, 7, 12, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0x65e8ff,
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        beacon.position.y = 4;
        group.add(beacon);

        // Ground Glow Ring
        const ringGeo = new THREE.RingGeometry(1.2, 1.5, 24);
        const ringMat = new THREE.MeshBasicMaterial({
            color: s.discovery.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.45
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.85;
        group.add(ring);

        scene3D.add(group);
        sample3DMeshes.push({ mesh: group, data: s });
    });

    // 3. Comm Relay Station Tower
    commsStation3D = new THREE.Group();
    commsStation3D.position.set(
        communicationStation.x,
        terrainHeightAt(communicationStation.x, communicationStation.z),
        communicationStation.z
    );

    const baseMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(2.5, 3.0, 1.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x244233, metalness: 0.8 })
    );
    baseMesh.position.y = 0.5;

    const towerMast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.4, 6.0, 8),
        new THREE.MeshStandardMaterial({ color: 0x93a398, metalness: 0.9 })
    );
    towerMast.position.y = 4.0;

    const dishMesh = new THREE.Mesh(
        new THREE.ConeGeometry(1.8, 0.8, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x4be084, emissive: 0x1f7842, emissiveIntensity: 0.6, metalness: 0.7 })
    );
    dishMesh.rotation.x = Math.PI / 2.8;
    dishMesh.position.set(0, 6.8, 0.6);

    const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x62ffa0 })
    );
    beacon.position.set(0, 7.3, 0.9);

    commsStation3D.add(baseMesh);
    commsStation3D.add(towerMast);
    commsStation3D.add(dishMesh);
    commsStation3D.add(beacon);
    scene3D.add(commsStation3D);

    // 4. Dust Storm Particle Dome (Mission 2+)
    if (dustStorm) {
        const stormGeo = new THREE.SphereGeometry(dustStorm.radius, 18, 18);
        const stormMat = new THREE.MeshBasicMaterial({
            color: 0xdf9c38,
            wireframe: true,
            transparent: true,
            opacity: 0.22
        });
        dustStorm3DMesh = new THREE.Mesh(stormGeo, stormMat);
        dustStorm3DMesh.position.set(dustStorm.x, terrainHeightAt(dustStorm.x, dustStorm.z), dustStorm.z);
        scene3D.add(dustStorm3DMesh);
    }
}

/* -------------------------------------------------------------------------
   GAME LOOPS & REAL 3D UPDATE
   ------------------------------------------------------------------------- */
function startGameLoop() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!game.running) return;
        game.time++;
        game.oxygen -= 0.05;
        if (game.oxygen <= 0) gameOver("Oxygen life support depleted.");
        updateUI();
    }, 1000);

    cancelAnimationFrame(animationFrame);
    gameLoop();
}

function stopGame() {
    game.running = false;
    keys = {};
    clearInterval(timerInterval);
    cancelAnimationFrame(animationFrame);
}

function gameLoop() {
    if (!game.running) return;
    updatePhysics();
    render3D();
    animationFrame = requestAnimationFrame(gameLoop);
}

function updatePhysics() {
    const horizontal = (keys["d"] || keys["arrowright"] ? 1 : 0) -
        (keys["a"] || keys["arrowleft"] ? 1 : 0);
    const vertical = (keys["s"] || keys["arrowdown"] ? 1 : 0) -
        (keys["w"] || keys["arrowup"] ? 1 : 0);
    const inputLength = Math.hypot(horizontal, vertical);
    let moveX;
    let moveZ;

    if (inputLength > 0) {
        const targetAngle = Math.atan2(horizontal / inputLength, vertical / inputLength);
        const angleDelta = Math.atan2(
            Math.sin(targetAngle - rover.angle),
            Math.cos(targetAngle - rover.angle)
        );
        rover.angle += angleDelta * 0.35;
        if (Math.abs(angleDelta) < 0.01) rover.angle = targetAngle;
        moveX = horizontal / inputLength;
        moveZ = vertical / inputLength;
        rover.speed = Math.min(rover.speed + rover.accel, rover.maxSpeed);
        game.battery -= 0.004;
    } else {
        rover.speed *= rover.friction;
        moveX = Math.sin(rover.angle);
        moveZ = Math.cos(rover.angle);
    }

    if (roverMast3D) roverMast3D.rotation.y = THREE.MathUtils.lerp(roverMast3D.rotation.y, 0, 0.1);

    const nextX = rover.x + moveX * rover.speed;
    const nextZ = rover.z + moveZ * rover.speed;

    // A rock impact ends the mission so the retry and home options are shown.
    if (isCollidingWithObstacle(nextX, nextZ, rover.size)) {
        gameOver("Your rover hit a rock. Try again or return to the home screen.");
        return;
    }

    rover.x = nextX;
    rover.z = nextZ;

    rover.x = Math.max(-WORLD_WIDTH / 2 + 3, Math.min(WORLD_WIDTH / 2 - 3, rover.x));
    rover.z = Math.max(-WORLD_HEIGHT / 2 + 3, Math.min(WORLD_HEIGHT / 2 - 3, rover.z));

    if (game.battery <= 0) {
        gameOver("Battery power fully drained.");
        return;
    }

    // Proximity checks
    checkSampleCollection();
    checkCommsProximity();
    checkDustStormProximity();
}

function isCollidingWithObstacle(x, z, radius) {
    for (const obs of obstacles) {
        const dx = Math.abs(x - obs.x);
        const dz = Math.abs(z - obs.z);
        if (dx < (obs.w * 0.5 + radius * 0.6) && dz < (obs.d * 0.5 + radius * 0.6)) {
            return true;
        }
    }
    return false;
}

function checkSampleCollection() {
    samples.forEach(sample => {
        if (sample.collected) return;
        const dist = Math.hypot(rover.x - sample.x, rover.z - sample.z);
        if (dist < 4.2) {
            sample.collected = true;
            game.samples++;
            game.score += 150;

            // Trigger robotic arm scoop animation
            if (roverArm3D) {
                roverArm3D.rotation.x = 0.8;
                setTimeout(() => { if (roverArm3D) roverArm3D.rotation.x = 0; }, 800);
            }

            // Remove 3D crystal
            const pair = sample3DMeshes.find(p => p.data.id === sample.id);
            if (pair) scene3D.remove(pair.mesh);

            showDiscovery(sample.discovery);
            updateUI();
        }
    });
}

function checkCommsProximity() {
    const required = game.mission === 1 ? 3 : game.mission === 2 ? 4 : 5;
    if (game.samples < required) return;

    const dist = Math.hypot(rover.x - communicationStation.x, rover.z - communicationStation.z);
    if (dist < communicationStation.radius + 2.5) {
        completeMission();
    }
}

function checkDustStormProximity() {
    if (!dustStorm) return;
    const dist = Math.hypot(rover.x - dustStorm.x, rover.z - dustStorm.z);
    if (dist < dustStorm.radius) {
        game.battery -= 0.035;
        document.getElementById("aiMessage").innerText = "⚠ Warning: Inside Martian dust storm! High power drain.";
    }
}

/* -------------------------------------------------------------------------
   RENDER & CAMERA TRACKING
   ------------------------------------------------------------------------- */
function render3D() {
    if (!renderer3D || !scene3D) return;

    const time = performance.now() * 0.003;

    // Update 3D Rover Transform
    if (rover3DGroup) {
        rover3DGroup.position.set(rover.x, terrainHeightAt(rover.x, rover.z), rover.z);
        rover3DGroup.rotation.y = rover.angle;

        // Suspension pitch/roll bounce when rolling
        const rollSway = Math.sin(time * 6) * rover.speed * 0.08;
        rover3DGroup.rotation.z = rollSway;

        // Spin wheels
        roverWheels3D.forEach(w => {
            w.children[0].rotation.x += rover.speed * 0.7;
        });
    }

    // Animate Crystals Float & Pulse
    sample3DMeshes.forEach(pair => {
        if (!pair.data.collected) {
            pair.mesh.children[0].rotation.y += 0.025;
            pair.mesh.position.y = 1.0 + Math.sin(time * 3 + pair.data.id) * 0.2;
        }
    });

    // Spin Comm Relay Radar Dish
    if (commsStation3D) {
        commsStation3D.children[2].rotation.z += 0.015;
    }

    // Rotate Dust Storm Wireframe
    if (dustStorm3DMesh) {
        dustStorm3DMesh.rotation.y += 0.008;
    }

    // Dynamic Camera Modes
    if (cameraMode === "tactical") {
        // High angle tactical 3D view following rover smoothly
        const targetCamX = rover.x * 0.35;
        const targetCamZ = rover.z * 0.35 + 30;
        camera3D.position.x = THREE.MathUtils.lerp(camera3D.position.x, targetCamX, 0.05);
        camera3D.position.y = THREE.MathUtils.lerp(camera3D.position.y, 34, 0.05);
        camera3D.position.z = THREE.MathUtils.lerp(camera3D.position.z, targetCamZ, 0.05);
        camera3D.lookAt(rover.x * 0.6, 0, rover.z * 0.6);
    } else {
        // Third-Person Chase Cam
        const behindDist = 14;
        const camX = rover.x - Math.sin(rover.angle) * behindDist;
        const camZ = rover.z - Math.cos(rover.angle) * behindDist;
        camera3D.position.x = THREE.MathUtils.lerp(camera3D.position.x, camX, 0.08);
        camera3D.position.y = THREE.MathUtils.lerp(camera3D.position.y, 7.5, 0.08);
        camera3D.position.z = THREE.MathUtils.lerp(camera3D.position.z, camZ, 0.08);
        camera3D.lookAt(rover.x, 2, rover.z);
    }

    renderer3D.render(scene3D, camera3D);
}

/* -------------------------------------------------------------------------
   AI PATHFINDING (A* IN 3D SPACE)
   ------------------------------------------------------------------------- */
function findSafeRoute() {
    if (!game.running) return;

    const required = game.mission === 1 ? 3 : game.mission === 2 ? 4 : 5;
    const remainingSamples = samples.filter(s => !s.collected);
    const dest = (game.samples < required && remainingSamples.length > 0)
        ? remainingSamples.sort((a, b) => Math.hypot(rover.x - a.x, rover.z - a.z) - Math.hypot(rover.x - b.x, rover.z - b.z))[0]
        : communicationStation;

    document.getElementById("aiMessage").innerText = (game.samples < required)
        ? "AI Path calculated: Follow the cyan laser vector to the nearest specimen."
        : "AI Path calculated: Direct vector line to the Comm Relay station.";

    // Render 3D Laser Guideline
    if (aiPath3DLine) scene3D.remove(aiPath3DLine);

    const points = [];
    points.push(new THREE.Vector3(rover.x, 1.2, rover.z));
    // Midpoint curved arc
    const midX = (rover.x + dest.x) * 0.5;
    const midZ = (rover.z + dest.z) * 0.5;
    points.push(new THREE.Vector3(midX, 2.5, midZ));
    points.push(new THREE.Vector3(dest.x, 1.2, dest.z));

    const curve = new THREE.CatmullRomCurve3(points);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
    const lineMat = new THREE.LineDashedMaterial({
        color: 0x00ffff,
        dashSize: 1.2,
        gapSize: 0.6,
        linewidth: 2
    });
    aiPath3DLine = new THREE.Line(lineGeo, lineMat);
    aiPath3DLine.computeLineDistances();
    scene3D.add(aiPath3DLine);
}

/* -------------------------------------------------------------------------
   SCIENTIFIC DISCOVERY & MISSION HUD
   ------------------------------------------------------------------------- */
function showDiscovery(discovery) {
    currentDiscovery = discovery;
    const discoveryPanel = document.querySelector(".discovery-panel");
    if (discoveryPanel) discoveryPanel.open = true;
    document.getElementById("discoveryBox").innerHTML = `
        <article class="discovery-card">
            <div class="discovery-heading">
                <span class="specimen-visual specimen-${discovery.visual}" style="--specimen-color: ${discovery.cssColor}" aria-hidden="true">
                    <i></i><i></i><i></i>
                </span>
                <span class="discovery-title">
                    <small>${discovery.category}</small>
                    <strong>${discovery.title}</strong>
                </span>
            </div>
            <p>${discovery.text}</p>
            <span class="discovery-caption">ARES-07 3D SPECTROMETER // ANALYSIS LOGGED</span>
            <button class="groq-study-button" type="button" onclick="studySampleWithGroq()">
                STUDY WITH GROQ AI
            </button>
            <p class="groq-analysis" id="groqAnalysis" aria-live="polite"></p>
        </article>
    `;
    game.score += 50;
}

async function studySampleWithGroq() {
    const discovery = currentDiscovery;
    const analysis = document.getElementById("groqAnalysis");
    const button = analysis?.closest(".discovery-card")?.querySelector(".groq-study-button");
    if (!discovery || !analysis || !button || button.disabled) return;

    button.disabled = true;
    button.innerText = "ANALYZING TELEMETRY...";
    analysis.innerText = "Querying Mars geology database...";

    try {
        const response = await fetch("/api/study-sample", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: discovery.title,
                category: discovery.category,
                description: discovery.text
            })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Analysis failed.");
        analysis.innerText = result.analysis;
    } catch (err) {
        analysis.innerText = err.message || "Could not retrieve AI analysis.";
    } finally {
        if (analysis.isConnected) {
            button.disabled = false;
            button.innerText = "STUDY WITH GROQ AI";
        }
    }
}

function completeMission() {
    stopGame();
    game.score += 500;
    const bonus = Math.max(0, Math.floor(game.battery * 2));
    game.score += bonus;

    document.getElementById("finalScore").innerText = game.score;
    document.getElementById("finalSamples").innerText = game.samples;
    document.getElementById("finalBattery").innerText = Math.floor(game.battery);
    document.getElementById("completeMessage").innerText =
        `Mission successful, Commander ${playerName}! The ARES-07 restored orbital comms with Earth.`;
    document.getElementById("nextMissionButton").innerText =
        game.mission >= 3 ? "VIEW FINAL RESULTS" : "NEXT MISSION";

    saveScore();
    showScreen("completeScreen");
}

function gameOver(reason) {
    stopGame();
    document.getElementById("gameOverReason").innerText = reason;
    showScreen("gameOverScreen");
}

function restartGame() {
    initializeMission();
    buildMission3DObjects();
    showScreen("gameScreen");
    startGameLoop();
}

function nextMission() {
    if (game.mission >= 3) {
        showLeaderboard();
        return;
    }
    game.mission++;
    initializeMission();
    buildMission3DObjects();
    showScreen("gameScreen");
    startGameLoop();
}

function quitMission() {
    stopGame();
    keys = {};
    showScreen("homeScreen");
}

function updateUI() {
    document.getElementById("missionNumber").innerText = game.mission;
    document.getElementById("score").innerText = Math.floor(game.score);
    document.getElementById("timer").innerText = game.time;
    document.getElementById("batteryText").innerText = Math.floor(game.battery) + "%";
    document.getElementById("oxygenText").innerText = Math.floor(game.oxygen) + "%";
    document.getElementById("batteryBar").style.width = Math.max(0, game.battery) + "%";
    document.getElementById("oxygenBar").style.width = Math.max(0, game.oxygen) + "%";
    document.getElementById("sampleText").innerText = game.samples;

    const required = game.mission === 1 ? 3 : game.mission === 2 ? 4 : 5;
    document.getElementById("requiredSamples").innerText = required;
    document.getElementById("objectiveText").innerText = game.samples < required
        ? `Recover glowing specimens: ${game.samples} of ${required} collected.`
        : "All specimens secured. Drive to the green Comm Relay station.";
}

/* -------------------------------------------------------------------------
   SERVER LEADERBOARD SYNC
   ------------------------------------------------------------------------- */
async function saveScore() {
    try {
        await fetch("/api/save-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                player_name: playerName,
                score: Math.floor(game.score),
                mission: game.mission,
                samples: game.samples,
                time_taken: game.time
            })
        });
    } catch (e) {
        console.error("Score save error:", e);
    }
}

async function showLeaderboard() {
    showScreen("leaderboardScreen");
    const body = document.getElementById("leaderboardBody");
    body.innerHTML = "<tr><td colspan='4'>Loading Leaderboard...</td></tr>";

    try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        body.innerHTML = "";
        if (!data.length) {
            body.innerHTML = "<tr><td colspan='4'>No mission records yet.</td></tr>";
            return;
        }
        data.forEach((row, i) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${i + 1}</td>
                <td>${escapeHtml(row.player_name)}</td>
                <td>${row.score}</td>
                <td>${row.mission}</td>
            `;
            body.appendChild(tr);
        });
    } catch (e) {
        body.innerHTML = "<tr><td colspan='4'>Failed to retrieve leaderboard.</td></tr>";
    }
}

function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}