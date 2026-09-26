const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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

let rover = {
    x: 80,
    y: 580,
    size: 30,
    speed: 4
};

let keys = {};

let timerInterval;
let animationFrame;

const gridSize = 50;

const cols = 18;
const rows = 11;

let obstacles = [];
let samples = [];
let dustStorm = null;
let communicationStation = null;
let suggestedPath = [];

const discoveries = [
    {
        title: "Martian Basalt",
        text: "Basalt is a volcanic rock that provides information about Mars' geological history."
    },
    {
        title: "Mars Atmosphere",
        text: "Mars has a thin atmosphere dominated by carbon dioxide."
    },
    {
        title: "Mars Water",
        text: "Scientists have found strong evidence of water ice on Mars."
    },
    {
        title: "Mars Rovers",
        text: "Robotic rovers allow scientists to investigate the Martian surface remotely."
    }
];


document.addEventListener("keydown", e => {
    if (e.key === "Escape" && game.running) {
        quitMission();
        return;
    }
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(e.key.toLowerCase())) {
        e.preventDefault();
    }
    keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

document.querySelectorAll(".drive-controls button").forEach(button => {
    button.addEventListener("click", () => {
        const moves = {
            arrowup: [0, -28], arrowdown: [0, 28],
            arrowleft: [-28, 0], arrowright: [28, 0]
        };
        const [dx, dy] = moves[button.dataset.key];
        moveRoverBy(dx, dy);
    });
});


function showScreen(id) {

    document.querySelectorAll(".screen")
        .forEach(screen => screen.classList.remove("active"));

    document.getElementById(id)
        .classList.add("active");
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

    playerName =
        document.getElementById("playerName").value.trim();

    if (!playerName) playerName = "Explorer";

    game.mission = 1;
    game.score = 0;

    initializeMission();

    showScreen("gameScreen");

    startGameLoop();
}


function initializeMission() {

    game.running = true;
    game.samples = 0;
    game.battery = 100;
    game.oxygen = 100;
    game.time = 0;
    suggestedPath = [];

    rover.x = 80;
    rover.y = 470;

    createMission();

    updateUI();
}


function createMission() {

    obstacles = [];

    samples = [];

    communicationStation = {
        x: 820,
        y: 70,
        size: 30
    };

    /*
       Fixed obstacles.
       Each obstacle is represented as x, y, width, height.
    */

    obstacles.push(
        { x: 180, y: 100, w: 120, h: 50 },
        { x: 380, y: 200, w: 150, h: 50 },
        { x: 600, y: 100, w: 80, h: 140 },
        { x: 200, y: 350, w: 130, h: 60 },
        { x: 480, y: 400, w: 100, h: 70 }
    );


    let requiredSamples =
        game.mission === 1 ? 3 :
        game.mission === 2 ? 4 :
        5;


    for (let i = 0; i < requiredSamples; i++) {

        let position;

        do {

            position = {
                x: 120 + Math.random() * 700,
                y: 80 + Math.random() * 400
            };

        } while (
            isInsideObstacle(
                position.x,
                position.y,
                20
            )
        );


        samples.push({
            x: position.x,
            y: position.y,
            collected: false,
            discovery: discoveries[
                i % discoveries.length
            ]
        });
    }


    if (game.mission === 2) {

        dustStorm = {
            active: true,
            x: 300,
            y: 100,
            radius: 130
        };

    } else {

        dustStorm = null;

    }
}


function startGameLoop() {

    clearInterval(timerInterval);

    timerInterval = setInterval(() => {

        if (!game.running) return;

        game.time++;

        game.oxygen -= 0.05;

        if (game.oxygen <= 0) {

            gameOver("Oxygen depleted.");

        }

        updateUI();

    }, 1000);


    cancelAnimationFrame(animationFrame);

    gameLoop();
}


function stopGame() {

    game.running = false;

    clearInterval(timerInterval);

    cancelAnimationFrame(animationFrame);
}


function gameLoop() {

    if (!game.running) return;

    update();

    draw();

    animationFrame =
        requestAnimationFrame(gameLoop);
}


function update() {

    let dx = 0;
    let dy = 0;

    if (keys["arrowup"] || keys["w"]) dy -= 1;

    if (keys["arrowdown"] || keys["s"]) dy += 1;

    if (keys["arrowleft"] || keys["a"]) dx -= 1;

    if (keys["arrowright"] || keys["d"]) dx += 1;


    if (dx !== 0 || dy !== 0) {

        const length =
            Math.sqrt(dx * dx + dy * dy);

        dx /= length;
        dy /= length;

        moveRoverBy(dx * rover.speed, dy * rover.speed, false);
    }


    checkSamples();

    checkCommunicationStation();

    checkDustStorm();

    keepRoverInside();
}


function keepRoverInside() {

    rover.x =
        Math.max(
            20,
            Math.min(canvas.width - 20, rover.x)
        );

    rover.y =
        Math.max(
            20,
            Math.min(canvas.height - 20, rover.y)
        );
}


function isInsideObstacle(x, y, size) {

    for (const obstacle of obstacles) {

        if (
            x + size > obstacle.x &&
            x - size < obstacle.x + obstacle.w &&
            y + size > obstacle.y &&
            y - size < obstacle.y + obstacle.h
        ) {

            return true;

        }

    }

    return false;
}


function checkSamples() {

    samples.forEach(sample => {

        if (sample.collected) return;

        const distance =
            Math.hypot(
                rover.x - sample.x,
                rover.y - sample.y
            );

        if (distance < 45) {

            sample.collected = true;

            game.samples++;

            game.score += 100;

            showDiscovery(
                sample.discovery
            );

        }

    });

    updateUI();
}


function showDiscovery(discovery) {

    document.getElementById(
        "discoveryBox"
    ).innerHTML = `
        <strong>${discovery.title}</strong>
        <br><br>
        ${discovery.text}
    `;

    game.score += 50;
}


function checkCommunicationStation() {

    const required =
        game.mission === 1 ? 3 :
        game.mission === 2 ? 4 :
        5;


    if (game.samples < required) return;


    const distance =
        Math.hypot(
            rover.x - communicationStation.x,
            rover.y - communicationStation.y
        );


    if (distance < 60) {

        completeMission();

    }
}


function checkDustStorm() {

    if (!dustStorm) return;

    const distance =
        Math.hypot(
            rover.x - dustStorm.x,
            rover.y - dustStorm.y
        );


    if (distance < dustStorm.radius) {

        game.battery -= 0.02;

        document.getElementById(
            "aiMessage"
        ).innerText =
            "⚠ Dust storm detected. Battery consumption increased.";

    }

}


function completeMission() {

    game.running = false;

    clearInterval(timerInterval);

    cancelAnimationFrame(animationFrame);

    game.score += 500;

    const bonus =
        Math.max(
            0,
            Math.floor(game.battery * 2)
        );

    game.score += bonus;

    document.getElementById(
        "finalScore"
    ).innerText = game.score;

    document.getElementById(
        "finalSamples"
    ).innerText = game.samples;

    document.getElementById(
        "finalBattery"
    ).innerText =
        Math.floor(game.battery);

    document.getElementById(
        "completeMessage"
    ).innerText =
        `Excellent work, Commander ${playerName}! Communication with Earth has been restored.`;

    document.getElementById("nextMissionButton").innerText =
        game.mission >= 3 ? "VIEW FINAL RESULTS" : "NEXT MISSION";

    saveScore();

    showScreen("completeScreen");
}


function gameOver(reason) {

    game.running = false;

    clearInterval(timerInterval);

    document.getElementById(
        "gameOverReason"
    ).innerText = reason;

    showScreen("gameOverScreen");
}


function restartGame() {

    initializeMission();

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

    showScreen("gameScreen");

    startGameLoop();
}


function updateUI() {

    document.getElementById(
        "missionNumber"
    ).innerText = game.mission;

    document.getElementById(
        "score"
    ).innerText = Math.floor(game.score);

    document.getElementById(
        "timer"
    ).innerText = game.time;

    document.getElementById(
        "batteryText"
    ).innerText =
        Math.floor(game.battery) + "%";

    document.getElementById(
        "oxygenText"
    ).innerText =
        Math.floor(game.oxygen) + "%";

    document.getElementById(
        "batteryBar"
    ).style.width =
        Math.max(0, game.battery) + "%";

    document.getElementById(
        "oxygenBar"
    ).style.width =
        Math.max(0, game.oxygen) + "%";

    document.getElementById(
        "sampleText"
    ).innerText =
        game.samples;


    const required =
        game.mission === 1 ? 3 :
        game.mission === 2 ? 4 :
        5;

    document.getElementById("requiredSamples").innerText = required;


    document.getElementById("objectiveText").innerText = game.samples < required
        ? `Collect blue samples: ${game.samples} of ${required} recovered.`
        : "All samples secured. Drive to the green COMMS station.";
}


function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    drawMarsSurface();

    drawGrid();

    drawObstacles();

    drawSamples();

    drawCommunicationStation();

    drawDustStorm();

    if (suggestedPath.length) drawPath(suggestedPath);

    drawRover();

}


function drawMarsSurface() {

    ctx.fillStyle = "#a94f2c";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
       Random-looking terrain craters
    */

    ctx.fillStyle = "rgba(80,30,20,0.3)";

    for (let i = 0; i < 80; i++) {

        const x =
            (i * 137) % canvas.width;

        const y =
            (i * 83) % canvas.height;

        const radius =
            3 + (i % 8);

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.fill();

    }
}


function drawGrid() {

    ctx.strokeStyle =
        "rgba(255,255,255,0.06)";

    for (
        let x = 0;
        x < canvas.width;
        x += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(x, 0);

        ctx.lineTo(x, canvas.height);

        ctx.stroke();
    }


    for (
        let y = 0;
        y < canvas.height;
        y += gridSize
    ) {

        ctx.beginPath();

        ctx.moveTo(0, y);

        ctx.lineTo(canvas.width, y);

        ctx.stroke();
    }
}


function drawObstacles() {

    obstacles.forEach(obstacle => {

        ctx.fillStyle = "#44261f";

        ctx.fillRect(
            obstacle.x,
            obstacle.y,
            obstacle.w,
            obstacle.h
        );


        ctx.strokeStyle = "#6f4132";

        ctx.strokeRect(
            obstacle.x,
            obstacle.y,
            obstacle.w,
            obstacle.h
        );

    });
}


function drawSamples() {

    samples.forEach(sample => {

        if (sample.collected) return;

        ctx.fillStyle = "#72e6ff";

        ctx.beginPath();

        ctx.arc(
    sample.x,
    sample.y,
    14,
    0,
    Math.PI * 2
);

        ctx.fill();

        ctx.fillStyle = "white";

        ctx.font = "12px Arial";

        ctx.fillText(
            "S",
            sample.x - 4,
            sample.y + 4
        );

    });
}


function drawCommunicationStation() {

    ctx.fillStyle = "#52d46d";

    ctx.fillRect(
        communicationStation.x - 15,
        communicationStation.y - 15,
        30,
        30
    );


    ctx.strokeStyle = "white";

    ctx.beginPath();

    ctx.moveTo(
        communicationStation.x,
        communicationStation.y - 15
    );

    ctx.lineTo(
        communicationStation.x,
        communicationStation.y - 40
    );

    ctx.stroke();


    ctx.fillStyle = "white";

    ctx.font = "bold 16px Arial";

    ctx.fillText(
        "COMMS",
        communicationStation.x - 25,
        communicationStation.y + 50
    );
}

function quitMission() {
    stopGame();
    keys = {};
    showScreen("homeScreen");
}

function drawDustStorm() {
    if (!dustStorm || !dustStorm.active) return;

    const gradient = ctx.createRadialGradient(
        dustStorm.x, dustStorm.y, 10,
        dustStorm.x, dustStorm.y, dustStorm.radius
    );
    gradient.addColorStop(0, "rgba(224, 181, 79, 0.42)");
    gradient.addColorStop(1, "rgba(224, 181, 79, 0.04)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(dustStorm.x, dustStorm.y, dustStorm.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 220, 120, 0.7)";
    ctx.setLineDash([7, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
}


function drawRover() {

    ctx.save();

    ctx.translate(
        rover.x,
        rover.y
    );

    /* Rover body */
    ctx.fillStyle = "#eeeeee";

    ctx.fillRect(
        -22,
        -14,
        44,
        28
    );

    /* Rover wheels */
    ctx.fillStyle = "#222";

    ctx.beginPath();

    ctx.arc(
        -15,
        16,
        7,
        0,
        Math.PI * 2
    );

    ctx.arc(
        15,
        16,
        7,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* Rover camera mast */
    ctx.fillStyle = "#777";

    ctx.fillRect(
        -4,
        -30,
        8,
        16
    );

    /* Camera */
    ctx.fillStyle = "#58b6e8";

    ctx.beginPath();

    ctx.arc(
        0,
        -33,
        8,
        0,
        Math.PI * 2
    );

    ctx.fill();

    /* Solar panel */
    ctx.fillStyle = "#4d79a8";

    ctx.fillRect(
        -32,
        -5,
        10,
        22
    );

    ctx.fillRect(
        22,
        -5,
        10,
        22
    );

    ctx.restore();
}


function findSafeRoute() {

    if (!game.running) return;


    const start = {
        x: Math.floor(rover.x / gridSize),
        y: Math.floor(rover.y / gridSize)
    };


    const required = game.mission === 1 ? 3 : game.mission === 2 ? 4 : 5;
    const nextSample = samples
        .filter(sample => !sample.collected)
        .sort((a, b) => Math.hypot(rover.x - a.x, rover.y - a.y) - Math.hypot(rover.x - b.x, rover.y - b.y))[0];
    const destination = game.samples < required ? nextSample : communicationStation;
    const target = { x: Math.floor(destination.x / gridSize), y: Math.floor(destination.y / gridSize) };


    const path =
        aStar(start, target);


    if (!path.length) {

        document.getElementById(
            "aiMessage"
        ).innerText =
            "No safe route found. Try moving away from obstacles.";

        return;
    }


    const distance =
        path.length * 5;


    document.getElementById("aiMessage").innerText = game.samples < required
        ? "Route shown in cyan. Follow it to the nearest blue sample."
        : "Route shown in cyan. Follow it to the green COMMS station.";

    suggestedPath = path;

}


function aStar(start, goal) {

    const open = [start];

    const cameFrom = {};

    const gScore = {};

    const fScore = {};


    const key = p => `${p.x},${p.y}`;


    gScore[key(start)] = 0;

    fScore[key(start)] =
        heuristic(start, goal);


    while (open.length > 0) {

        open.sort(
            (a, b) =>
                (fScore[key(a)] ?? Infinity) -
                (fScore[key(b)] ?? Infinity)
        );


        const current =
            open.shift();


        if (
            current.x === goal.x &&
            current.y === goal.y
        ) {

            return reconstructPath(
                cameFrom,
                current
            );
        }


        const neighbors =
            getNeighbors(current);


        for (const neighbor of neighbors) {

            const neighborKey =
                key(neighbor);

            const tentative =
                (gScore[key(current)] ?? Infinity) + 1;


            if (
                tentative <
                (gScore[neighborKey] ?? Infinity)
            ) {

                cameFrom[neighborKey] =
                    current;

                gScore[neighborKey] =
                    tentative;

                fScore[neighborKey] =
                    tentative +
                    heuristic(
                        neighbor,
                        goal
                    );


                if (
                    !open.some(
                        p =>
                            p.x === neighbor.x &&
                            p.y === neighbor.y
                    )
                ) {

                    open.push(neighbor);

                }

            }

        }

    }


    return [];
}


function heuristic(a, b) {

    return Math.abs(
        a.x - b.x
    ) + Math.abs(
        a.y - b.y
    );
}


function getNeighbors(node) {

    const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
    ];


    return directions
        .map(direction => ({
            x: node.x + direction.x,
            y: node.y + direction.y
        }))
        .filter(node => {

            if (
                node.x < 0 ||
                node.y < 0 ||
                node.x >= cols ||
                node.y >= rows
            ) {

                return false;

            }


            return !isGridBlocked(node);

        });
}


function isGridBlocked(node) {

    const x =
        node.x * gridSize + gridSize / 2;

    const y =
        node.y * gridSize + gridSize / 2;


    return isInsideObstacle(
        x,
        y,
        15
    );
}


function reconstructPath(cameFrom, current) {

    const path = [current];

    const key =
        p => `${p.x},${p.y}`;


    while (cameFrom[key(current)]) {

        current =
            cameFrom[key(current)];

        path.unshift(current);
    }


    return path;
}


function drawPath(path) {

    ctx.save();

    ctx.strokeStyle =
        "#6ff0ff";

    ctx.lineWidth = 5;
    ctx.setLineDash([10, 7]);
    ctx.shadowColor = "#6ff0ff";
    ctx.shadowBlur = 8;

    ctx.beginPath();


    path.forEach((node, index) => {

        const x =
            node.x * gridSize +
            gridSize / 2;

        const y =
            node.y * gridSize +
            gridSize / 2;


        if (index === 0) {

            ctx.moveTo(x, y);

        } else {

            ctx.lineTo(x, y);

        }

    });


    ctx.stroke();

    ctx.setLineDash([]);

    ctx.restore();

}


async function saveScore() {

    try {

        await fetch("/api/save-score", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                player_name: playerName,

                score: Math.floor(game.score),

                mission: game.mission,

                samples: game.samples,

                time_taken: game.time

            })

        });

    } catch (error) {

        console.error(
            "Could not save score:",
            error
        );

    }
}


async function showLeaderboard() {

    showScreen("leaderboardScreen");


    const body =
        document.getElementById(
            "leaderboardBody"
        );


    body.innerHTML =
        "<tr><td colspan='4'>Loading...</td></tr>";


    try {

        const response =
            await fetch(
                "/api/leaderboard"
            );


        const data =
            await response.json();


        body.innerHTML = "";


        if (data.length === 0) {

            body.innerHTML =
                "<tr><td colspan='4'>No scores yet.</td></tr>";

            return;
        }


        data.forEach(
            (row, index) => {

                body.innerHTML += `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHtml(row.player_name)}</td>
                        <td>${row.score}</td>
                        <td>${row.mission}</td>
                    </tr>
                `;

            }
        );

    } catch (error) {

        body.innerHTML =
            "<tr><td colspan='4'>Unable to load leaderboard.</td></tr>";

    }

}


function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;
}

function moveRoverBy(dx, dy, fromButton = true) {
    if (!game.running) return;

    const newX = rover.x + dx;
    const newY = rover.y + dy;

    if (isInsideObstacle(newX, newY, rover.size)) {
        gameOver("Rover collision detected. You hit a Martian rock formation.");
        return;
    }

    rover.x = newX;
    rover.y = newY;
    keepRoverInside();
    game.battery -= fromButton ? 0.25 : 0.01;

    if (game.battery <= 0) gameOver("Battery depleted.");
}
