import * as THREE from 'three';
// Optional: If you want camera controls for easy viewing in development
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer;
let gameDiceMesh, movieDiceMesh;
let gameRollLabel, movieRollLabel; // References to the 2D labels
let games = [];
let movies = [];

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


// --- Three.js Setup ---
function initThreeJS() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa); // Light background

    // Camera
    camera = new THREE.PerspectiveCamera(75, threejsViewContainer.clientWidth / threejsViewContainer.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 3); // Adjusted position
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(threejsViewContainer.clientWidth, threejsViewContainer.clientHeight);
    threejsViewContainer.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xaaaaaa);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7).normalize();
    scene.add(directionalLight);

    // Dice Meshes (Simple Cubes)
    const geometry = new THREE.BoxGeometry(1, 1, 1); // Cube size 1x1x1
    const gameMaterial = new THREE.MeshStandardMaterial({ color: 0xe74c3c }); // Reddish-orange
    const movieMaterial = new THREE.MeshStandardMaterial({ color: 0x3498db }); // Bluish

    gameDiceMesh = new THREE.Mesh(geometry, gameMaterial);
    movieDiceMesh = new THREE.Mesh(geometry, movieMaterial);

    // Position the dice relative to the center (0,0,0)
    gameDiceMesh.position.x = -1.5; // Position left
    movieDiceMesh.position.x = 1.5;  // Position right

    scene.add(gameDiceMesh);
    scene.add(movieDiceMesh);

    // Optional: Add ground plane
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, side: THREE.DoubleSide }); // Light grey material
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2; // Rotate to be horizontal
    plane.position.y = -0.5; // Position slightly below the dice
    scene.add(plane);

    // Optional: Orbit Controls for development (uncomment if using)
    // const controls = new OrbitControls(camera, renderer.domElement);
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.25;
    // controls.screenSpacePanning = false;

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Initial render
    renderer.render(scene, camera);

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
    renderer.render(scene, camera);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // If using OrbitControls:
    // controls.update();

    renderer.render(scene, camera);
}

// --- UI and Game Logic ---

// Add this function after the existing functions but before the event listeners
function showEmptyListMessage(ulElement) {
    const emptyMessage = ulElement.querySelector('.empty-list-message');
    if (ulElement.children.length === 1) { // Only the empty message remains
        emptyMessage.style.display = 'block';
    } else {
        emptyMessage.style.display = 'none';
    }
}

// Update the renderList function
function renderList(list, ulElement, type) {
    ulElement.innerHTML = ''; // Clear current list
    
    // Add empty list message
    const emptyMessage = document.createElement('li');
    emptyMessage.className = 'empty-list-message';
    emptyMessage.textContent = type === 'games' 
        ? 'No games added yet. Add some games to create your dice!'
        : 'No movies/shows added yet. Add some to create your dice!';
    ulElement.appendChild(emptyMessage);
    
    list.forEach((item, index) => {
        const li = document.createElement('li');
        li.textContent = item;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.dataset.index = index;
        deleteBtn.dataset.type = type;
        deleteBtn.setAttribute('aria-label', `Delete ${item}`);
        li.appendChild(deleteBtn);
        ulElement.appendChild(li);
    });
    
    showEmptyListMessage(ulElement);
}

// Update the addItem function
function addItem(list, inputElement, ulElement, type) {
    const itemName = inputElement.value.trim();
    if (itemName) {
        list.push(itemName);
        renderList(list, ulElement, type);
        inputElement.value = '';
        inputElement.focus(); // Return focus to input
        updateSidesDisplay();
        
        // Show success feedback
        const feedback = document.createElement('div');
        feedback.className = 'success-feedback';
        feedback.textContent = `${itemName} added!`;
        feedback.setAttribute('aria-live', 'polite');
        ulElement.parentNode.insertBefore(feedback, ulElement);
        
        // Remove feedback after animation
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => feedback.remove(), 300);
        }, 1500);
    }
}

// Update the deleteItem function
function deleteItem(event) {
    if (event.target.tagName === 'BUTTON' && event.target.textContent === 'Delete') {
        const index = parseInt(event.target.dataset.index);
        const type = event.target.dataset.type;
        const list = type === 'games' ? games : movies;
        const ulElement = type === 'games' ? gameListUl : movieListUl;
        
        if (index >= 0 && index < list.length) {
            const deletedItem = list[index];
            list.splice(index, 1);
            renderList(list, ulElement, type);
            updateSidesDisplay();
            
            // Show deletion feedback
            const feedback = document.createElement('div');
            feedback.className = 'delete-feedback';
            feedback.textContent = `${deletedItem} removed`;
            feedback.setAttribute('aria-live', 'polite');
            ulElement.parentNode.insertBefore(feedback, ulElement);
            
            // Remove feedback after animation
            setTimeout(() => {
                feedback.style.opacity = '0';
                setTimeout(() => feedback.remove(), 300);
            }, 1500);
        }
    }
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

// Roll die function (JavaScript's Math.random)
function rollDie(sides) {
    if (sides <= 0) {
        return 0; // Cannot roll a die with 0 or fewer sides
    }
    return Math.floor(Math.random() * sides) + 1;
}

// Replace the showNotification function with showPopup
function showPopup(message) {
    const popup = document.getElementById('result-popup');
    const popupMessage = document.getElementById('popup-message');
    const closeButton = document.querySelector('.close-button');
    
    popupMessage.textContent = message;
    popup.style.display = 'block';
    
    // Close popup when clicking the close button
    closeButton.onclick = function() {
        popup.style.display = 'none';
    }
    
    // Close popup when clicking outside the modal
    window.onclick = function(event) {
        if (event.target === popup) {
            popup.style.display = 'none';
        }
    }
}

// Update the handleRollDice function
function handleRollDice() {
    const gameSides = games.length;
    const movieSides = movies.length;
    
    // Disable roll button during animation
    rollDiceBtn.disabled = true;
    rollDiceBtn.textContent = 'Rolling...';
    
    // Update displays
    gameRollDisplay.textContent = `Games Die (Sides: ${gameSides}) Roll: -`;
    movieRollDisplay.textContent = `Movies/Shows Die (Sides: ${movieSides}) Roll: -`;
    winnerDisplay.textContent = 'Winner: Rolling...';
    
    gameRollLabel.textContent = `Games: Rolling...`;
    movieRollLabel.textContent = `Movies/Shows: Rolling...`;
    
    if (gameSides === 0 && movieSides === 0) {
        winnerDisplay.textContent = 'Winner: Both lists are empty. Cannot roll.';
        gameRollLabel.textContent = `Games: N/A`;
        movieRollLabel.textContent = `Movies/Shows: N/A`;
        rollDiceBtn.disabled = false;
        rollDiceBtn.textContent = 'Roll Dice!';
        return;
    }
    
    // Roll dice (roll 0 if sides is 0, otherwise roll 1 to sides)
    const gameRoll = rollDie(gameSides);
    const movieRoll = rollDie(movieSides);

    // Animation duration and setup
    const rollDuration = 1200; // milliseconds
    const startTime = Date.now();
    const initialRotationG = gameDiceMesh.rotation.clone();
    const initialRotationM = movieDiceMesh.rotation.clone();

    // Store final roll values and sides to display AFTER animation
    const finalGameRoll = gameRoll;
    const finalMovieRoll = movieRoll;
    const finalGameSides = gameSides;
    const finalMovieSides = movieSides;

    function animateRoll() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / rollDuration, 1); // Progress from 0 to 1

        // Simple random rotation during the "roll" that eases out
        const easeOutProgress = 1 - Math.pow(1 - progress, 3); // Easing function
        const rotateSpeed = 0.5; // Adjust speed of rotation

        // Apply random rotation proportional to remaining animation time
        gameDiceMesh.rotation.x = initialRotationG.x + (Math.random() * 4 * Math.PI - 2 * Math.PI) * (1 - easeOutProgress);
        gameDiceMesh.rotation.y = initialRotationG.y + (Math.random() * 4 * Math.PI - 2 * Math.PI) * (1 - easeOutProgress);
        gameDiceMesh.rotation.z = initialRotationG.z + (Math.random() * 4 * Math.PI - 2 * Math.PI) * (1 - easeOutProgress);

        movieDiceMesh.rotation.x = initialRotationM.x + (Math.random() * 4 * Math.PI - 2 * Math.PI) * (1 - easeOutProgress);
        movieDiceMesh.rotation.y = initialRotationM.y + (Math.random() * 4 * Math.PI - 2 * Math.PI) * (1 - easeOutProgress);
        movieDiceMesh.rotation.z = initialRotationM.z + (Math.random() * 4 * Math.PI - 2 * Math.PI) * (1 - easeOutProgress);


        renderer.render(scene, camera);

        if (progress < 1) {
            requestAnimationFrame(animateRoll);
        } else {
            // Animation finished - update UI with final results
            gameRollDisplay.textContent = `Games Die (Sides: ${finalGameSides}) Roll: ${finalGameRoll}`;
            movieRollDisplay.textContent = `Movies/Shows Die (Sides: ${finalMovieSides}) Roll: ${finalMovieRoll}`;
            
            gameRollLabel.textContent = `Games: ${finalGameRoll}`;
            movieRollLabel.textContent = `Movies/Shows: ${finalMovieRoll}`;
            
            if (finalGameRoll > finalMovieRoll) {
                const winningGame = games[finalGameRoll - 1];
                winnerDisplay.textContent = `Winner: Games Die! (Rolled ${finalGameRoll})`;
                showPopup(`🎮 Game Selected: ${winningGame}`);
            } else if (finalMovieRoll > finalGameRoll) {
                const winningMovie = movies[finalMovieRoll - 1];
                winnerDisplay.textContent = `Winner: Movies/Shows Die! (Rolled ${finalMovieRoll})`;
                showPopup(`🎬 Movie/Show Selected: ${winningMovie}`);
            } else {
                winnerDisplay.textContent = `Winner: It's a Tie! (Both rolled ${finalGameRoll})`;
                showPopup("It's a tie! Roll again!");
            }
            
            // Reset button state
            rollDiceBtn.disabled = false;
            rollDiceBtn.textContent = 'Roll Dice!';
            
            // Reset rotation
            gameDiceMesh.rotation.set(0, 0, 0);
            movieDiceMesh.rotation.set(0, 0, 0);
            renderer.render(scene, camera);
        }
    }

    // Start the animation
    animateRoll();
}


// --- Event Listeners ---
addGameBtn.addEventListener('click', () => addItem(games, newGameInput, gameListUl, 'games'));
addMovieBtn.addEventListener('click', () => addItem(movies, newMovieInput, movieListUl, 'movies'));

// Allow adding by pressing Enter in input fields
newGameInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addItem(games, newGameInput, gameListUl, 'games');
        event.preventDefault(); // Prevent default form submission if input is in a form
    }
});
 newMovieInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        addItem(movies, newMovieInput, movieListUl, 'movies');
        event.preventDefault(); // Prevent default form submission
    }
});


// Listen for clicks on the ULs to handle delete buttons using delegation
gameListUl.addEventListener('click', deleteItem);
movieListUl.addEventListener('click', deleteItem);

rollDiceBtn.addEventListener('click', handleRollDice);


// --- Initialization ---
initThreeJS(); // Setup the 3D scene
renderList(games, gameListUl, 'games'); // Initial render of empty lists
renderList(movies, movieListUl, 'movies');
updateSidesDisplay(); // Initialize side count display

// Note: The main animate() loop started in initThreeJS continues to run
// for potential continuous rendering needs (like OrbitControls).
// The animateRoll() function is a separate, temporary animation called on roll.