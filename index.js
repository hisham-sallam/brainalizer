import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';

const RIGHT_MOUSE_BUTTON = 2;
const RAY_INTERVAL = 25; // in ms

const scene = new THREE.Scene();
const loader = new GLTFLoader();
const raycast = new THREE.Raycaster();
const raycast_mouse = new THREE.Vector2();
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
const renderer = new THREE.WebGLRenderer();

const callout = document.getElementById('callout');
const calloutText = document.getElementById('callout-text');

const brain_part_names = new Set(["Thalamus", "Hypothalamus", "Amygdala", "Brainstem", "Cerebellum", 
                          "Frontal_Lobe", "Parietal_Lobe", "Occipital_Lobe", "Temporal_Lobe", "Hippocampus", "Corpus_Callesum"]);
const brainstem_material = new THREE.MeshStandardMaterial({ color: 0x5b8def });
const frontal_lobe_material = new THREE.MeshStandardMaterial({ color: 0xf2c14e });
const parietal_lobe_material = new THREE.MeshStandardMaterial({ color: 0x6cc070 });
const occipital_lobe_material = new THREE.MeshStandardMaterial({ color: 0xe0707a });
const temporal_lobe_material = new THREE.MeshStandardMaterial({ color: 0xf08a4b });
const cerebellum_material = new THREE.MeshStandardMaterial({ color: 0xeadfc8 });
const thalamus_material = new THREE.MeshStandardMaterial({ color: 0x9b6bd1 });
const hypothalamus_material = new THREE.MeshStandardMaterial({ color: 0xd94f70 });
const amygdala_material = new THREE.MeshStandardMaterial({ color: 0x7fd1cf });
const hippocampus_material = new THREE.MeshStandardMaterial({ color: 0xb7d94c });
const Corpus_Callesum_material = new THREE.MeshStandardMaterial({ color: 0x8a6a56 });

const brain_materials_map = new Map([
    ["Thalamus", thalamus_material],
    ["Hypothalamus", hypothalamus_material],
    ["Amygdala", amygdala_material],
    ["Brainstem", brainstem_material],
    ["Cerebellum", cerebellum_material],
    ["Frontal_Lobe", frontal_lobe_material],
    ["Parietal_Lobe", parietal_lobe_material],
    ["Occipital_Lobe", occipital_lobe_material],
    ["Temporal_Lobe", temporal_lobe_material],
    ["Hippocampus", hippocampus_material],
    ["Corpus_Callesum", Corpus_Callesum_material]
]);

const brain_part_nodes = new Map();   
const options = [];          

let screen_width = window.innerWidth;
let screen_height = window.innerHeight;

let mouse = new THREE.Vector2();
let is_right_mouse_down = false;

let last_ray = 0;
let needs_raycast = false;
let hoveredPart = null;

let calloutActive = false;

let orbital_camera = {
    camera: new THREE.PerspectiveCamera(60, screen_width / screen_height, 0.01, 1000),

    orbital_radius: 5,
    min_radius: 0.1,
    max_radius: 10,

    azimuth: 0,
    elevation: 0,

    elevation_limit: 1.5,
    mouse_sensitivity: 0.005,
    zoom_speed: 0.001,

    camera_movement: () => {

        if (is_right_mouse_down) {

            orbital_camera.azimuth += mouse.x * orbital_camera.mouse_sensitivity;
            orbital_camera.elevation += mouse.y * orbital_camera.mouse_sensitivity;
            orbital_camera.elevation = clamp(orbital_camera.elevation, -orbital_camera.elevation_limit, orbital_camera.elevation_limit);

            mouse.x = 0;
            mouse.y = 0;
        }

        let ce = Math.cos(orbital_camera.elevation);
        let se = Math.sin(orbital_camera.elevation);

        let ca = Math.cos(orbital_camera.azimuth);
        let sa = Math.sin(orbital_camera.azimuth);

        let x = orbital_camera.orbital_radius * ce * sa;
        let y = orbital_camera.orbital_radius * se;
        let z = orbital_camera.orbital_radius * ce * ca;

        orbital_camera.camera.position.set(x, y, z);
        orbital_camera.camera.lookAt(0, 0, 0);
    }
};

function setPartMaterial(name, material) {
    brain_part_nodes.get(name)?.traverse((child) => {
        if (child.isMesh) child.material = material ?? child.userData.originalMaterial;
    });
}

function clamp(num, min, max) {
    return Math.min(Math.max(num, min), max);
}

function getCollectionName(obj, collection_names) {
    let current = obj;
    while (current) {
        if (collection_names.has(current.name)) return current.name;
        current = current.parent;
    }
    return null;
}

function showCallout(text) {
    calloutText.textContent = text;
    calloutActive = true;
    callout.classList.add('visible');
}

function hideCallout() {
    calloutActive = false;
    callout.classList.remove('visible');
}

function setSliderPartOpacity(highlightGroups = []) {
    for (const part of options) {
        part.material.transparent = true;
        part.material.opacity = 0.05;

        const shouldHighlight = highlightGroups.some((groupName) =>
            brain_part_nodes.get(groupName)?.children.includes(part)
        );

        if (shouldHighlight) {
            part.material.transparent = false;
            part.material.opacity = 1;
        }
    }
}

function gameInit() {

    scene.background = new THREE.Color(0x888888);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);


    loader.load('assets/brain.glb', (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        model.traverse((child) => {
            if (brain_part_names.has(child.name)) brain_part_nodes.set(child.name, child);
                if (child.isMesh) {
                    child.userData.originalMaterial = child.material;
                    options.push(child);
                }
        });
    });


    orbital_camera.camera.position.set(0, 0, orbital_camera.orbital_radius);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(screen_width, screen_height);
    renderer.setAnimationLoop(gameLoop);
    document.body.appendChild(renderer.domElement);

}

function gameLoop(dt) {
    orbital_camera.camera_movement();

    if (needs_raycast && options.length > 0 && performance.now() - last_ray >= RAY_INTERVAL) {
        last_ray = performance.now();
        needs_raycast = false;
        orbital_camera.camera.updateMatrixWorld();
        raycast.setFromCamera(raycast_mouse, orbital_camera.camera);
        const hits = raycast.intersectObjects(options, false);

        let visible_hit = -1;
        if (hits.length > 0) {
            for (let i = 0; i < hits.length; i++) {
                if (hits[i].object.material.opacity > 0.1) {
                    visible_hit = i;
                    break;
                }
                visible_hit = -1;
            }
        }

        const name = visible_hit >= 0 ? getCollectionName(hits[visible_hit].object, brain_part_names) : null;

        if (name !== hoveredPart) {
            if (hoveredPart) setPartMaterial(hoveredPart, null);  
            if (name) setPartMaterial(name, brain_materials_map.get(name));  
            switch (name) {
                case 'Thalamus':
                    showCallout('Thalamus\n\nThe thalamus is a structure in the middle of the brain that is responsible for replaying sensory information, relaying motor information, prioritizing attention, keeping you alert and awake, and assisting memory.');
                    break;
                case 'Hypothalamus':
                    showCallout('Hypothalamus\n\nThe hypothalamus is the main link between the endocrine system and nervous system, it maintains homeostasis. The hypothalamus helps manage the body temperature, blood pressure, hunger and thirst, mood and sleep.');
                    break;
                case 'Amygdala':
                    showCallout('Amygdala\n\nThe amygdala is needed for processing emotional reactions and making emotional connections to experiences. The amygdala is used for emotional regulation, like processing certain emotions. \n\nIt’s also responsible for a stress response, which is your “flight or fight”. The amygdala also influences social interactions.');
                    break;
                case 'Brainstem':
                    showCallout('Brainstem (Pons and Medulla)\n\nThe brainstem sends messages back and forth between the brain and the body. It helps control balance, blood pressure, breathing, eye movement, facial movement, hearing, heart rate, sleep and taste.\n\nRunning through its core is the reticular formation.\n\n The reticular formation is crucial because it helps with breathing, reflexive movements, posture, balance, and the your sleep schedule.');
                    break;
                case 'Cerebellum':
                    showCallout('Cerebellum \n\nThe cerebellum is responsible for most core functions. It’s responsible for coordination, balance and posture, error correction, motor learning and eye movement. The cerebellum also assists in cognition and emotion.');
                    break;
                case 'Frontal_Lobe':
                    showCallout('Frontal Lobe (including Primary Motor Cortex)\n\n The frontal lobe makes you able to process simple and complex information, controls understanding social norms and what is right and wrong, and is responsible for executive functions like self control, attention span, and memory. \n\nThe frontal lobe is also responsible for your voluntary movements and your learning capabilities. \n\nThe primary motor cortex makes neural signals that travel down the spinal cord to trigger movement.');
                    break;
                case 'Parietal_Lobe':
                    showCallout('Parietal Lobe (including Somatosensory Cortex)\n\nThe parietal lobe is the professing center for sensations you can feel with touch, like temperature, pressure, vibration and pain. \n\nThe parietal lobe takes in the sensory information other parts of the brain have processed and makes you understand it. It’s also responsible for learned movements and location awareness. ');
                    break;
                case 'Occipital_Lobe':
                    showCallout('Occipital Lobe \n\nThe occipital lobe, which is the smallest part, is one of the most important lobes. It is responsible for visual signals sent from the eyes. \n\nThe retina takes in information, sends information through the optic nerves, and the occipital lobe is responsible for decoding the information and processes it.');
                    break;
                case 'Temporal_Lobe':
                    showCallout('Temporal Lobe \n\nThe temporal lobe, which is inside the hippocampus, is responsible for memory, understanding a language, how you show emotion (which is the amygdala), processes senses, and is responsible for visual recognition.');
                    break;
                case 'Hippocampus':
                    showCallout('Hippocampus\n\nThe hippocampus is responsible for a few cognitive functions like learning, short term and long term memory, verbal memory and declarative memory.');
                    break;
                case 'Corpus_Callesum':
                    showCallout('Corpus Callosum\n\nThe corpus callosum is responsible for sending nerve signals between two sides of the brain. The nerve signals are messages that help coordinate your senses, movement and cognitive functions.');
                    break;
                default:
                    hideCallout();
                    break;
            }
            hoveredPart = name;
        }
    }

    renderer.render(scene, orbital_camera.camera);
}

document.addEventListener('mousemove', (e) => {
    if (!calloutActive) return;

    callout.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;

    const boxW = calloutText.offsetWidth + 70;
    const boxH = calloutText.offsetHeight + 70;
    callout.classList.toggle('flip-x', e.clientX + boxW > window.innerWidth);
    callout.classList.toggle('flip-y', e.clientY - boxH < 0);
});

// preventing right click context menu to move the camera
window.addEventListener('contextmenu', (event) => event.preventDefault());

// mouse button checking
window.addEventListener('mousedown', (event) => {
    if (event.button === RIGHT_MOUSE_BUTTON) {
        is_right_mouse_down = true;
    }
});
window.addEventListener('mouseup', (event) => {
    if (event.button === RIGHT_MOUSE_BUTTON) {
        is_right_mouse_down = false;
    }
});

// tracking mouse movement
window.addEventListener('mousemove', (event) => {
    if (is_right_mouse_down) {
        mouse.x = -event.movementX;
        mouse.y = event.movementY;
    }
    else {
        raycast_mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        raycast_mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        needs_raycast = true;
    }
});

// tracking mouse wheel
window.addEventListener('wheel', (event) => {
    event.preventDefault();
    orbital_camera.orbital_radius += event.deltaY * orbital_camera.zoom_speed;
    orbital_camera.orbital_radius = clamp(orbital_camera.orbital_radius, orbital_camera.min_radius, orbital_camera.max_radius);
    needs_raycast = true; 
}, { passive: false });

// window resize to for multiple res
window.addEventListener('resize', () => {
    orbital_camera.camera.aspect = window.innerWidth / window.innerHeight;
    orbital_camera.camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('slider').addEventListener('input', (event) => {
    switch (event.target.value) {
        case '0':
            for (const part of options) {
                part.material.transparent = true;
                part.material.opacity = 1;
            }
            break;
        case '1':
            setSliderPartOpacity([
                'Frontal_Lobe',
                'Parietal_Lobe',
                'Occipital_Lobe',
                'Temporal_Lobe'
            ]);
            break;
        case '2':
            setSliderPartOpacity(['Cerebellum', 'Corpus_Callesum']);
            break;
        case '3':
            setSliderPartOpacity(['Amygdala', 'Hippocampus']);
            break;
        case '4':
            setSliderPartOpacity(['Thalamus']);
            break;
        case '5':
            setSliderPartOpacity(['Hypothalamus']);
            break;
        case '6':
            setSliderPartOpacity(['Brainstem']);
            break;
    }
});

gameInit();