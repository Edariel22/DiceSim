import * as THREE from 'three';
// Optional: If you want camera controls for easy viewing in development
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'; // For HDRIs
import * as CANNON from 'cannon-es';

// --- Global Variables ---
let scene, camera, renderer, controls;
let world; // Cannon-es physics world
let gameDiceMesh, movieDiceMesh;
let gameDiceBody, movieDiceBody, groundBody; // Cannon-es physics bodies
let gameRollLabel, movieRollLabel; // References to the 2D labels
let games = [];
let movies = [];
let isRolling = false; // Flag to prevent multiple rolls at once
let diceStoppedCheckInterval; // Interval to check if dice have stopped


// Get DOM elements
const gameListUl = document.getElementById('game-list');
const movieListUl = document.getElementById('movie-list');
const newGameInput = document.getElementById('new-game-input');
const newMovieInput = document.getElementById('new-movie-input');
const addGameBtn = document.getElementById('add-game-btn');
const addMovieBtn = document.getElementById('add-movie-btn');
const rollDiceBtn = document.getElementById('roll-dice-btn');
const gameRollDisplay = document.getElementById('game-roll-display');
const movieRollDisplay = document.getElementById('movie-roll-display');
const winnerDisplay = document.getElementById('winner-display');
const threejsViewContainer = document.getElementById('threejs-view');

gameRollLabel = document.getElementById('game-dice-label');
movieRollLabel = document.getElementById('movie-dice-label');
const popup = document.getElementById('result-popup');
const popupMessage = document.getElementById('popup-message');
const closeButton = document.querySelector('.close-button');


// --- Physics Setup ---
function initPhysics() {
    world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0),
        allowSleep: true,
        broadphase: new CANNON.SAPBroadphase(world),
        defaultContactMaterial: {
            friction: 0.3,
            restitution: 0.3
        }
    });

    // Create ground plane physics body
    const groundShape = new CANNON.Plane();
    groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // Create boundary walls
    const wallShape = new CANNON.Box(new CANNON.Vec3(5, 0.5, 0.1));
    const wallPhysicsMaterial = new CANNON.Material('wallMaterial');
    
    // Create walls
    const walls = [
        { position: new CANNON.Vec3(0, 0, 5), quaternion: new CANNON.Quaternion() }, // Front
        { position: new CANNON.Vec3(0, 0, -5), quaternion: new CANNON.Quaternion() }, // Back
        { position: new CANNON.Vec3(5, 0, 0), quaternion: new CANNON.Quaternion().setFromEuler(0, Math.PI/2, 0) }, // Right
        { position: new CANNON.Vec3(-5, 0, 0), quaternion: new CANNON.Quaternion().setFromEuler(0, Math.PI/2, 0) } // Left
    ];

    walls.forEach(wall => {
        const wallBody = new CANNON.Body({
            mass: 0,
            shape: wallShape,
            material: wallPhysicsMaterial,
            position: wall.position,
            quaternion: wall.quaternion
        });
        world.addBody(wallBody);
    });

    // Create dice physics bodies
    const diceMass = 1;
    const boxHalfExtents = new CANNON.Vec3(0.5, 0.5, 0.5);
    const diceShape = new CANNON.Box(boxHalfExtents);
    const diceMaterial = new CANNON.Material('diceMaterial');
    const groundMaterial = new CANNON.Material('groundMaterial');

    // Create contact materials
    const diceGroundContact = new CANNON.ContactMaterial(groundMaterial, diceMaterial, {
        friction: 0.3,
        restitution: 0.3
    });
    const diceWallContact = new CANNON.ContactMaterial(wallPhysicsMaterial, diceMaterial, {
        friction: 0.3,
        restitution: 0.3
    });
    world.addContactMaterial(diceGroundContact);
    world.addContactMaterial(diceWallContact);

    gameDiceBody = new CANNON.Body({ 
        mass: diceMass, 
        shape: diceShape, 
        material: diceMaterial,
        linearDamping: 0.2,
        angularDamping: 0.2
    });
    movieDiceBody = new CANNON.Body({ 
        mass: diceMass, 
        shape: diceShape, 
        material: diceMaterial,
        linearDamping: 0.2,
        angularDamping: 0.2
    });

    world.addBody(gameDiceBody);
    world.addBody(movieDiceBody);
}


// --- Three.js Setup ---
function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);

    // Camera setup
    camera = new THREE.PerspectiveCamera(45, threejsViewContainer.clientWidth / threejsViewContainer.clientHeight, 0.1, 1000);
    camera.position.set(0, 4, 6);
    camera.lookAt(0, 0, 0);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(threejsViewContainer.clientWidth, threejsViewContainer.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    threejsViewContainer.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -5;
    directionalLight.shadow.camera.right = 5;
    directionalLight.shadow.camera.top = 5;
    directionalLight.shadow.camera.bottom = -5;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 30;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Add a ground plane that's larger to catch the dice
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: 0xE9ECEF,
        side: THREE.DoubleSide,
        roughness: 0.8,
        metalness: 0
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -0.5;
    plane.receiveShadow = true;

    scene.add(plane);
    // Add a boundary to keep dice in view
    const boundaryGeometry = new THREE.BoxGeometry(5, 5, 5);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: true,
        transparent: true,
        opacity: 0.1
    });
    const boundary = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    boundary.position.y = .5;
    scene.add(boundary);

    // Add physics boundary walls
    const wallThickness = 0.1;
    const wallHeight = 5;
    const wallWidth = 5;

    // Create walls
    const walls = [
        { size: [wallWidth, wallHeight, wallThickness], position: [0, wallHeight/2, wallWidth/2], rotation: [0, 0, 0] },  // Front
        { size: [wallWidth, wallHeight, wallThickness], position: [0, wallHeight/2, -wallWidth/2], rotation: [0, 0, 0] }, // Back
        { size: [wallThickness, wallHeight, wallWidth], position: [wallWidth/2, wallHeight/2, 0], rotation: [0, 0, 0] },  // Right
        { size: [wallThickness, wallHeight, wallWidth], position: [-wallWidth/2, wallHeight/2, 0], rotation: [0, 0, 0] }  // Left
    ];

    walls.forEach(wall => {
        const wallBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(wall.size[0]/2, wall.size[1]/2, wall.size[2]/2))
        });
        wallBody.position.set(wall.position[0], wall.position[1], wall.position[2]);
        wallBody.quaternion.setFromEuler(wall.rotation[0], wall.rotation[1], wall.rotation[2]);
        world.addBody(wallBody);
    });

    // Dice materials
    const gameMaterial = new THREE.MeshStandardMaterial({
        color: 0xFD7E14,
        metalness: 0.2,
        roughness: 0.4
    });
    const movieMaterial = new THREE.MeshStandardMaterial({
        color: 0x6F42C1,
        metalness: 0.2,
        roughness: 0.4
    });

    // Dice geometry
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    gameDiceMesh = new THREE.Mesh(geometry, gameMaterial);
    movieDiceMesh = new THREE.Mesh(geometry, movieMaterial);

    gameDiceMesh.castShadow = true;
    movieDiceMesh.castShadow = true;

    scene.add(gameDiceMesh);
    scene.add(movieDiceMesh);

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start the animation loop
    animate();
}

function onWindowResize() {
    // Update camera aspect ratio and projection matrix
    camera.aspect = threejsViewContainer.clientWidth / threejsViewContainer.clientHeight;
    camera.updateProjectionMatrix();

    // Update renderer size to match the container
    renderer.setSize(threejsViewContainer.clientWidth, threejsViewContainer.clientHeight);

    // Re-render the scene after resize
    // renderer.render(scene, camera); // Render is called in animate loop
}

// Animation loop (renders scene and steps physics)
const timeStep = 1 / 60; // fixed physics step
let lastTime = 0;
function animate(time) {
    requestAnimationFrame(animate);

    // Calculate delta time
    const dt = time !== undefined ? (time - lastTime) / 1000 : timeStep;
    lastTime = time;

    // Step the physics world
    if (world) {
        world.step(timeStep);

        // Copy position and rotation from physics to three.js
        gameDiceMesh.position.copy(gameDiceBody.position);
        gameDiceMesh.quaternion.copy(gameDiceBody.quaternion);

        movieDiceMesh.position.copy(movieDiceBody.position);
        movieDiceMesh.quaternion.copy(movieDiceBody.quaternion);
    }

    renderer.render(scene, camera);
}

// --- UI and Game Logic ---

// Function to display message when list is empty
function showEmptyListMessage(ulElement) {
    const emptyMessage = ulElement.querySelector('.empty-list-message');
    if (ulElement.children.length === 1) { // Only the empty message remains
        emptyMessage.style.display = 'block';
    } else {
        emptyMessage.style.display = 'none';
    }
}

// Render items from array to the HTML list
function renderList(list, ulElement, type) {
    ulElement.innerHTML = ''; // Clear current list

    // Add empty list message placeholder
    const emptyMessage = document.createElement('li');
    emptyMessage.className = 'empty-list-message';
    emptyMessage.textContent = type === 'game'
        ? 'No games added yet. Add some games to create your dice!'
        : 'No movies/shows added yet. Add some to create your dice!';
    ulElement.appendChild(emptyMessage); // Add it even when list is not empty, control display via CSS


    list.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = item;
        li.classList.add('list-item'); // Add class for styling

        // Create delete button (using icon would be more professional)
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('btn', 'btn-danger'); // Add classes for styling
        deleteBtn.dataset.index = index; // Store index for deletion
        deleteBtn.dataset.type = type; // Store type (game or movie)
        deleteBtn.setAttribute('aria-label', `Delete ${item}`);

        li.appendChild(deleteBtn);
        ulElement.appendChild(li);
    });

    showEmptyListMessage(ulElement); // Check and display message if list is truly empty
}


// Load saved data from localStorage on page load
function loadSavedData() {
    const savedGames = localStorage.getItem('savedGames');
    const savedMovies = localStorage.getItem('savedMovies');

    if (savedGames) {
        try {
            games = JSON.parse(savedGames);
        } catch (e) {
            console.error("Failed to parse saved games data:", e);
            games = []; // Reset if data is corrupt
        }
    }

    if (savedMovies) {
        try {
            movies = JSON.parse(savedMovies);
        } catch (e) {
            console.error("Failed to parse saved movies data:", e);
            movies = []; // Reset if data is corrupt
        }
    }
}

// Save data to localStorage
function saveData() {
    try {
        localStorage.setItem('savedGames', JSON.stringify(games));
        localStorage.setItem('savedMovies', JSON.stringify(movies));
    } catch (e) {
        console.error("Failed to save data to local storage:", e);
        // Optionally provide user feedback that saving failed
    }
}

// Show temporary feedback message (for add/delete)
function showFeedback(message, type, ulElement) {
     // Remove existing feedback messages for this list
     ulElement.parentNode.querySelectorAll('.feedback-message').forEach(fb => fb.remove());

    const feedback = document.createElement('div');
    feedback.className = `feedback-message ${type === 'success' ? 'success-feedback' : 'delete-feedback'}`;
    feedback.textContent = message;
    feedback.setAttribute('aria-live', 'polite'); // Announce to screen readers

    // Insert feedback above the list
    ulElement.parentNode.insertBefore(feedback, ulElement);

    // Remove feedback after animation/delay
    setTimeout(() => {
        feedback.style.opacity = '0';
        setTimeout(() => feedback.remove(), 300); // Remove after fade out
    }, 2000); // Display for 2 seconds
}


// Update the addItem function
function addItem(list, inputElement, ulElement, type) {
    const newItem = inputElement.value.trim();
    if (newItem) {
        list.push(newItem);
        renderList(list, ulElement, type);
        saveData(); // Save after adding item
        updateSidesDisplay();
        inputElement.value = ''; // Clear input
        inputElement.focus(); // Return focus to input

        showFeedback(`${newItem} added!`, 'success', ulElement);
    }
}

// Update the deleteItem function
function deleteItem(event) {
    // Use event delegation on the UL, but check if a delete button was clicked
    if (!event.target.classList.contains('btn-danger')) return;

    const button = event.target;
    const listItem = button.closest('.list-item');
    if (!listItem) return; // Should not happen if delegation is on UL

    const ulElement = listItem.parentElement;
    const type = button.dataset.type; // 'game' or 'movie'
    // Find the index of the list item within the UL, ignoring the empty message
    const index = Array.from(ulElement.children).filter(child => child.classList.contains('list-item')).indexOf(listItem);

    if (index === -1) return; // Should not happen


    let deletedItem;
    if (type === 'game') {
        if (index >= 0 && index < games.length) {
            deletedItem = games[index];
            games.splice(index, 1);
            renderList(games, gameListUl, 'game');
             showFeedback(`${deletedItem} removed.`, 'delete', gameListUl);
        }
    } else if (type === 'movie') {
         if (index >= 0 && index < movies.length) {
            deletedItem = movies[index];
            movies.splice(index, 1);
            renderList(movies, movieListUl, 'movie');
             showFeedback(`${deletedItem} removed.`, 'delete', movieListUl);
         }
    } else {
        return; // Invalid type
    }

    saveData(); // Save after deleting item
    updateSidesDisplay(); // Update side counts and results display
}


// Function to update the side count display in the results area
function updateSidesDisplay() {
     const gameSides = games.length;
    const movieSides = movies.length;
     gameRollDisplay.textContent = `Games Die (Sides: ${gameSides}) Roll: -`;
     movieRollDisplay.textContent = `Movies/Shows Die (Sides: ${movieSides}) Roll: -`;
     winnerDisplay.textContent = 'Winner: -'; // Reset winner display
      gameRollLabel.textContent = `Games: -`; // Reset label
     movieRollLabel.textContent = `Movies/Shows: -`; // Reset label
}

/**
 * Rolls a die with the specified number of sides using a good random source.
 * This is the *outcome* generator, independent of the physics simulation.
 * @param {number} sides - The number of sides on the die (equal to the number of items in the list)
 * @returns {number} - A random integer between 1 and sides (inclusive), or 0 if sides <= 0
 */
function rollDie(sides) {
    if (sides <= 0) {
        return 0; // Cannot roll a die with 0 or fewer sides
    }

    // Use crypto.getRandomValues if available (more secure), fallback to Math.random
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        // Map the random 32-bit integer to the range [1, sides]
        // Use floating point for division before flooring to reduce bias for large ranges
        return Math.floor(array[0] / (0xFFFFFFFF + 1) * sides) + 1;

    } else {
        // Fallback to Math.random if crypto API is not available
        return Math.floor(Math.random() * sides) + 1;
    }
}

/**
 * Determines the winner between two dice rolls and selects the winning item.
 * @param {number} gameRoll - The roll value for the Games Die
 * @param {number} movieRoll - The roll value for the Movies/Shows Die
 * @param {number} gameSides - The number of sides on the Games Die
 * @param {number} movieSides - The number of sides on the Movies/Shows Die
 * @returns {Object} - An object containing the winner and selected item
 */
function determineWinner(gameRoll, movieRoll, gameSides, movieSides) {
    let winner = 'tie';
    let selectedItem = null;
    
    if (gameRoll > movieRoll) {
        winner = 'games';
        if (gameSides > 0) {
            selectedItem = games[gameRoll - 1]; // Select item based on roll number
        }
    } else if (movieRoll > gameRoll) {
        winner = 'movies';
        if (movieSides > 0) {
            selectedItem = movies[movieRoll - 1]; // Select item based on roll number
        }
    } else {
        // It's a tie, no specific item is selected from *either* list as "the" winner
        winner = 'tie';
    }
    
    return { winner, selectedItem };
}

// Show popup with selected item
function showPopup(message) {
    popupMessage.textContent = message;
    popup.style.display = 'flex'; // Use flex to center content

    // Automatically hide popup after a few seconds
    setTimeout(() => {
        popup.style.display = 'none';
    }, 5000); // Hide after 5 seconds
}

// Close popup when clicking the close button
closeButton.onclick = function() {
    popup.style.display = 'none';
}

// Close popup when clicking outside the modal content
window.onclick = function(event) {
    if (event.target === popup) {
        popup.style.display = 'none';
    }
}


// --- Dice Rolling Logic (Physics Integrated) ---
function handleRollDice() {
    if (isRolling) return;

    const gameSides = games.length;
    const movieSides = movies.length;

    if (gameSides === 0 && movieSides === 0) {
        winnerDisplay.textContent = 'Winner: Both lists are empty. Cannot roll.';
        gameRollLabel.textContent = `Games: N/A`;
        movieRollLabel.textContent = `Movies/Shows: N/A`;
        return;
    }

    isRolling = true;
    rollDiceBtn.disabled = true;
    rollDiceBtn.textContent = 'Rolling...';

    // Reset positions with a smaller range
    const initialY = 2;
    const initialX_Game = -1;
    const initialX_Movie = 1;

    gameDiceMesh.position.set(initialX_Game, initialY, 0);
    movieDiceMesh.position.set(initialX_Movie, initialY, 0);
    gameDiceBody.position.copy(gameDiceMesh.position);
    movieDiceBody.position.copy(movieDiceMesh.position);

    // Reset velocities
    gameDiceBody.velocity.set(0, 0, 0);
    movieDiceBody.velocity.set(0, 0, 0);
    gameDiceBody.angularVelocity.set(0, 0, 0);
    movieDiceBody.angularVelocity.set(0, 0, 0);

    // Apply forces with reduced magnitude
    const forceMagnitude = 3;
    const upForce = 1.5;
    const maxSpin = 3;

    const gameForce = new CANNON.Vec3(
        (Math.random() - 0.5) * forceMagnitude,
        upForce + Math.random() * forceMagnitude,
        (Math.random() - 0.5) * forceMagnitude
    );
    const movieForce = new CANNON.Vec3(
        (Math.random() - 0.5) * forceMagnitude,
        upForce + Math.random() * forceMagnitude,
        (Math.random() - 0.5) * forceMagnitude
    );

    const gameTorque = new CANNON.Vec3(
        (Math.random() - 0.5) * maxSpin,
        (Math.random() - 0.5) * maxSpin,
        (Math.random() - 0.5) * maxSpin
    );
    const movieTorque = new CANNON.Vec3(
        (Math.random() - 0.5) * maxSpin,
        (Math.random() - 0.5) * maxSpin,
        (Math.random() - 0.5) * maxSpin
    );

    gameDiceBody.applyImpulse(gameForce, gameDiceBody.position);
    gameDiceBody.applyTorque(gameTorque);
    movieDiceBody.applyImpulse(movieForce, movieDiceBody.position);
    movieDiceBody.applyTorque(movieTorque);

    // Wake up bodies
    gameDiceBody.wakeUp();
    movieDiceBody.wakeUp();

    // Check for dice stopping with reduced time
    let checkCount = 0;
    const maxChecks = 100; // Reduced to about 10 seconds
    
    diceStoppedCheckInterval = setInterval(() => {
        checkCount++;
        
        // If dice are still rolling after 6 seconds, force them to stop and re-roll
        if (checkCount >= 60) { // 60 checks * 100ms = 6 seconds
            clearInterval(diceStoppedCheckInterval);
            gameDiceBody.sleep();
            movieDiceBody.sleep();
            isRolling = false;
            showPopup("Dice got stuck! Re-rolling...");
            setTimeout(handleRollDice, 500);
            return;
        }
        
        // Check if dice are sleeping or if we've reached max checks
        if ((gameDiceBody.sleepState === CANNON.Body.SLEEPING && 
             movieDiceBody.sleepState === CANNON.Body.SLEEPING) ||
            checkCount >= maxChecks) {
            
            clearInterval(diceStoppedCheckInterval);

            // Force dice to sleep if they haven't naturally
            if (checkCount >= maxChecks) {
                gameDiceBody.sleep();
                movieDiceBody.sleep();
            }

            const finalGameRoll = rollDie(gameSides);
            const finalMovieRoll = rollDie(movieSides);
            const { winner, selectedItem } = determineWinner(finalGameRoll, finalMovieRoll, gameSides, movieSides);

            // If it's a tie, roll again automatically
            if (winner === 'tie') {
                // Reset the dice positions and velocities
                gameDiceMesh.position.set(initialX_Game, initialY, 0);
                movieDiceMesh.position.set(initialX_Movie, initialY, 0);
                gameDiceBody.position.copy(gameDiceMesh.position);
                movieDiceBody.position.copy(movieDiceMesh.position);
                gameDiceBody.velocity.set(0, 0, 0);
                movieDiceBody.velocity.set(0, 0, 0);
                gameDiceBody.angularVelocity.set(0, 0, 0);
                movieDiceBody.angularVelocity.set(0, 0, 0);

                // Apply new forces
                gameDiceBody.applyImpulse(gameForce, gameDiceBody.position);
                gameDiceBody.applyTorque(gameTorque);
                movieDiceBody.applyImpulse(movieForce, movieDiceBody.position);
                movieDiceBody.applyTorque(movieTorque);

                // Wake up bodies and continue rolling
                gameDiceBody.wakeUp();
                movieDiceBody.wakeUp();
                checkCount = 0;
                return;
            }

            isRolling = false;
            rollDiceBtn.disabled = false;
            rollDiceBtn.textContent = 'Roll Dice!';

            gameRollDisplay.textContent = `Games Die (Sides: ${gameSides}) Roll: ${finalGameRoll}`;
            movieRollDisplay.textContent = `Movies/Shows Die (Sides: ${movieSides}) Roll: ${finalMovieRoll}`;
            gameRollLabel.textContent = `Games: ${finalGameRoll}`;
            movieRollLabel.textContent = `Movies/Shows: ${finalMovieRoll}`;

            if (winner === 'games') {
                winnerDisplay.textContent = `Winner: Games Die! (Rolled ${finalGameRoll})`;
                if (selectedItem) {
                    showPopup(`🎮 Game Selected: ${selectedItem}`);
                }
            } else if (winner === 'movies') {
                winnerDisplay.textContent = `Winner: Movies/Shows Die! (Rolled ${finalMovieRoll})`;
                if (selectedItem) {
                    showPopup(`🎬 Movie/Show Selected: ${selectedItem}`);
                }
            }
        }
    }, 100);
}


// --- Event Listeners ---
addGameBtn.addEventListener('click', () => addItem(games, newGameInput, gameListUl, 'game'));
addMovieBtn.addEventListener('click', () => addItem(movies, newMovieInput, movieListUl, 'movie'));

// Allow adding by pressing Enter in input fields
newGameInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addItem(games, newGameInput, gameListUl, 'game');
        event.preventDefault(); // Prevent default form submission
    }
});
 newMovieInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addItem(movies, newMovieInput, movieListUl, 'movie');
        event.preventDefault(); // Prevent default form submission
    }
});


// Listen for clicks on the ULs to handle delete buttons using delegation
gameListUl.addEventListener('click', deleteItem);
movieListUl.addEventListener('click', deleteItem);

rollDiceBtn.addEventListener('click', handleRollDice);


// --- Initialization ---
initPhysics(); // Setup physics world
initThreeJS(); // Setup 3D scene and link to physics bodies
loadSavedData(); // Load saved data
renderList(games, gameListUl, 'game'); // Initial render of empty lists
renderList(movies, movieListUl, 'movie');
updateSidesDisplay(); // Initialize side count display

// The main animate() loop now handles both rendering and physics steps.