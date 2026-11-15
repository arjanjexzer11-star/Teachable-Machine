
/* ==========================================
   PAGE NAVIGATION
========================================== */

function showPage(pageName) {

    // Stop both models when changing pages
    stopImage();
    stopAudio();

    // Hide all pages
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active-page");
    });

    // Remove active navigation style
    document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.remove("active");
    });

    // Show selected page
    document.getElementById(pageName).classList.add("active-page");

    // Highlight selected navigation button
    document.getElementById(pageName + "Nav").classList.add("active");
}


/* ==========================================
   IMAGE MODEL
========================================== */

// Image model folder
const IMAGE_URL = "./image_model/";

let imageModel;
let webcam;
let imageRunning = false;
let imageLoading = false;
let imageMaxPredictions = 0;


// START IMAGE MODEL
async function initImage() {

    if (imageRunning || imageLoading) return;

    imageLoading = true;

    const startButton = document.getElementById("imageStartBtn");
    const stopButton = document.getElementById("imageStopBtn");
    const status = document.getElementById("imageStatus");
    const container = document.getElementById("webcam-container");

    startButton.disabled = true;
    status.textContent = "Status: Loading Image Model...";

    try {

        // Load model and metadata
        const modelURL = IMAGE_URL + "model.json";
        const metadataURL = IMAGE_URL + "metadata.json";

        imageModel = await tmImage.load(modelURL, metadataURL);

        imageMaxPredictions = imageModel.getTotalClasses();

        // Setup webcam
        const flip = true;

        webcam = new tmImage.Webcam(320, 320, flip);

        await webcam.setup();
        await webcam.play();

        // Clear previous content
        container.replaceChildren();

        // Display webcam
        container.appendChild(webcam.canvas);

        // Clear old predictions
        createEmptyMessage(
            "image-label-container",
            "Detecting images..."
        );

        imageRunning = true;

        startButton.disabled = true;
        stopButton.disabled = false;

        status.textContent = "Status: Camera Active";

        // Start prediction loop
        window.requestAnimationFrame(imageLoop);

    } catch (error) {

        console.error("Image Model Error:", error);

        status.textContent = "Status: Error - " + error.message;

        stopImage();

    } finally {

        imageLoading = false;

        if (!imageRunning) {
            startButton.disabled = false;
        }
    }
}


// IMAGE PREDICTION LOOP
async function imageLoop() {

    if (!imageRunning) return;

    try {

        webcam.update();

        await predictImage();

    } catch (error) {

        console.error("Image Prediction Error:", error);

        stopImage();

        return;
    }

    if (imageRunning) {
        window.requestAnimationFrame(imageLoop);
    }
}


// PREDICT IMAGE
async function predictImage() {

    const prediction = await imageModel.predict(webcam.canvas);

    const container = document.getElementById("image-label-container");

    container.replaceChildren();

    // Display each class prediction
    for (let i = 0; i < imageMaxPredictions; i++) {

        const className = prediction[i].className;
        const probability = prediction[i].probability;

        addPrediction(
            container,
            className,
            probability
        );
    }
}


// STOP IMAGE MODEL
function stopImage() {

    imageRunning = false;

    if (webcam) {

        webcam.stop();
        webcam = null;
    }

    const container = document.getElementById("webcam-container");

    container.replaceChildren();

    const message = document.createElement("p");
    message.textContent = "Camera preview will appear here.";

    container.appendChild(message);

    document.getElementById("imageStartBtn").disabled = imageLoading;
    document.getElementById("imageStopBtn").disabled = true;

    if (!imageLoading) {
        document.getElementById("imageStatus").textContent =
            "Status: Not Started";
    }

    createEmptyMessage(
        "image-label-container",
        "Waiting for image detection..."
    );
}


/* ==========================================
   AUDIO MODEL
========================================== */

// Audio model folder
// Convert the relative folder path into an absolute HTTP(S) URL.
// Run this website through Live Server (http://localhost), not file://.
const AUDIO_URL = new URL("./audio_model/", window.location.href).href;

let audioRecognizer;
let audioRunning = false;
let audioLoading = false;


// LOAD AUDIO MODEL
async function createAudioModel() {

    const checkpointURL = AUDIO_URL + "model.json";
    const metadataURL = AUDIO_URL + "metadata.json";

    const recognizer = speechCommands.create(
        "BROWSER_FFT",
        undefined,
        checkpointURL,
        metadataURL
    );

    // Wait until model is loaded
    await recognizer.ensureModelLoaded();

    return recognizer;
}


// START AUDIO MODEL
async function initAudio() {

    if (audioRunning || audioLoading) return;

    audioLoading = true;

    const startButton = document.getElementById("audioStartBtn");
    const stopButton = document.getElementById("audioStopBtn");
    const status = document.getElementById("audioStatus");
    const display = document.getElementById("audioDisplay");

    startButton.disabled = true;

    status.textContent = "Status: Loading Audio Model...";
    display.textContent = "Loading Model...";

    try {

        // Load Teachable Machine audio model
        audioRecognizer = await createAudioModel();

        const classLabels = audioRecognizer.wordLabels();

        // Clear old predictions
        const container = document.getElementById("audio-label-container");

        container.replaceChildren();

        audioRunning = true;

        // Start listening to microphone
        audioRecognizer.listen(result => {

            const scores = result.scores;

            container.replaceChildren();

            for (let i = 0; i < classLabels.length; i++) {

                addPrediction(
                    container,
                    classLabels[i],
                    scores[i]
                );
            }

            // Find highest prediction
            let highestIndex = 0;

            for (let i = 1; i < scores.length; i++) {

                if (scores[i] > scores[highestIndex]) {
                    highestIndex = i;
                }
            }

            const confidence = scores[highestIndex];

            display.textContent =
                confidence >= 0.75
                    ? "Detected: " + classLabels[highestIndex]
                    : "Listening for sounds...";

        }, {

            includeSpectrogram: false,

            probabilityThreshold: 0.75,

            invokeCallbackOnNoiseAndUnknown: true,

            overlapFactor: 0.50

        });

        startButton.disabled = true;
        stopButton.disabled = false;

        status.textContent = "Status: Microphone Active";
        display.textContent = "Listening...";

    } catch (error) {

        console.error("Audio Model Error:", error);

        status.textContent = "Status: Error - " + error.message;
        display.textContent = "Microphone Error";

        stopAudio();

    } finally {

        audioLoading = false;

        if (!audioRunning) {
            startButton.disabled = false;
        }
    }
}


// STOP AUDIO MODEL
function stopAudio() {

    audioRunning = false;

    if (audioRecognizer) {

        try {
            audioRecognizer.stopListening();
        } catch (error) {
            console.error("Audio Stop Error:", error);
        }

        audioRecognizer = null;
    }

    document.getElementById("audioStartBtn").disabled = audioLoading;
    document.getElementById("audioStopBtn").disabled = true;

    if (!audioLoading) {

        document.getElementById("audioStatus").textContent =
            "Status: Not Started";

        document.getElementById("audioDisplay").textContent =
            "Microphone Ready";
    }

    createEmptyMessage(
        "audio-label-container",
        "Waiting for audio detection..."
    );
}


/* ==========================================
   PREDICTION DISPLAY
========================================== */

// Create a prediction item with confidence bar
function addPrediction(container, className, probability) {

    const percentage = Math.max(
        0,
        Math.min(100, probability * 100)
    );

    const item = document.createElement("div");
    item.className = "prediction-item";

    const info = document.createElement("div");
    info.className = "prediction-info";

    const name = document.createElement("span");
    name.className = "prediction-name";
    name.textContent = className;

    const score = document.createElement("span");
    score.className = "prediction-score";
    score.textContent = percentage.toFixed(1) + "%";

    info.appendChild(name);
    info.appendChild(score);

    const bar = document.createElement("div");
    bar.className = "progress-bar";

    const fill = document.createElement("div");
    fill.className = "progress-fill";

    fill.style.width = percentage + "%";

    bar.appendChild(fill);

    item.appendChild(info);
    item.appendChild(bar);

    container.appendChild(item);
}


// Display empty message
function createEmptyMessage(containerId, message) {

    const container = document.getElementById(containerId);

    container.replaceChildren();

    const paragraph = document.createElement("p");

    paragraph.className = "empty-message";
    paragraph.textContent = message;

    container.appendChild(paragraph);
}
