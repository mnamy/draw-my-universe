import './style.css';

import {
  FilesetResolver,
  HandLandmarker,
} from '@mediapipe/tasks-vision';


(() => {
  const STORAGE_KEY = 'drawMyUniverseDrawings';

  const STAR_SPACING = 18;
  const POINT_HOLD_TIME = 1200;
  const POINT_STILL_THRESHOLD = 25;
  const PALM_HOLD_TIME = 700;
  const HAND_LOST_WARNING_TIME = 1000;

  let handLandmarker = null;

  let video = null;
  let canvas = null;
  let ctx = null;

  let cameraStream = null;
  let cameraStarted = false;
  let animationFrameId = null;
  let lastVideoTime = -1;

  let drawingPoints = [];
  let lastPoint = null;
  let drawingFinished = false;
  let drawingActive = false;

  let pointStartTime = null;
  let pointStartPosition = null;

  let palmStartTime = null;

  let hasSeenHand = false;
  let handLostStartTime = null;

  let savedDrawings = loadSavedDrawings();


  /* --------------------------------------------------------------------------
     GLOBAL UI
     -------------------------------------------------------------------------- */

  const root = document.createElement('div');

  root.className = 'star-draw';

  root.innerHTML = `
    <!-- PERMANENT BOTTOM-RIGHT BUTTON -->

    <button
      class="star-draw__launcher"
      id="starDrawLauncher"
      type="button"
      aria-haspopup="dialog"
    >
      ✦ draw something ✦
    </button>


    <!-- MODAL -->

    <div
      class="star-draw__overlay"
      id="starDrawOverlay"
      hidden
    >
      <section
        class="star-draw__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="starDrawTitle"
      >

        <!-- CLOSE MODAL -->

        <button
          class="star-draw__modal-close"
          id="starModalClose"
          type="button"
          aria-label="Close"
        >
          ×
        </button>


        <!-- ================================================================
             INTRO
             ================================================================ -->

        <div
          class="star-draw__view"
          id="starIntroView"
        >
          <p class="star-draw__eyebrow">
            interactive corner
          </p>

          <h2
            class="star-draw__script-title"
            id="starDrawTitle"
          >
            draw in my universe
          </h2>

          <ol class="star-draw__instructions">
            <li>
              point your index finger and hold it still to begin
            </li>

            <li>
              move your finger through the air to draw with stars
            </li>

            <li>
              open your palm when you're finished
            </li>
          </ol>

          <div class="star-draw__actions star-draw__intro-actions">

            <button
              class="star-draw__button star-draw__button--primary"
              id="starStartButton"
              type="button"
            >
              start drawing
            </button>

            <button
              class="star-draw__button"
              id="starViewUniverseButton"
              type="button"
              hidden
            >
              view my universe
            </button>

          </div>
        </div>


        <!-- ================================================================
             CAMERA
             ================================================================ -->

        <div
          class="star-draw__view"
          id="starCameraView"
          hidden
        >
          <div class="star-draw__camera-panel">

            <!-- RIGHT SIDE: INSTRUCTIONS -->

            <div class="star-draw__camera-top">

              <p class="star-draw__eyebrow">
                interactive corner
              </p>

              <h2 class="star-draw__script-title">
                draw in my universe
              </h2>

              <ol
                class="
                  star-draw__instructions
                  star-draw__instructions--compact
                "
              >
                <li>
                  point your index finger and hold it still to begin
                </li>

                <li>
                  move your finger through the air to draw with stars
                </li>

                <li>
                  open your palm when you're finished
                </li>
              </ol>

            </div>


            <!-- LEFT SIDE: CAMERA -->

            <div class="star-draw__camera">

              <!--
                Shows immediately while the browser/device
                prepares its camera permission prompt.
              -->

              <div
                class="star-draw__camera-permission"
                id="starCameraPermission"
              >
                <p class="star-draw__camera-permission-title">
                  your device will ask for camera access
                </p>

                <p class="star-draw__camera-permission-text">
                  choose allow to start drawing with your finger ✦
                </p>
              </div>


              <video
                id="starWebcam"
                autoplay
                playsinline
              ></video>


              <canvas
                id="starDrawingCanvas"
                width="640"
                height="480"
              ></canvas>


              <!-- DISCARD CURRENT ATTEMPT -->

              <button
                class="star-draw__camera-reset"
                id="starCameraReset"
                type="button"
                aria-label="Discard this drawing and start over"
                title="Start over"
              >
                ×
              </button>

            </div>


            <!-- LIVE STATUS -->

            <p
              class="star-draw__status"
              id="starDrawStatus"
              aria-live="polite"
            >
              loading...
            </p>


            <!-- REDO / SAVE -->

            <div
              class="star-draw__actions"
              id="starDrawingActions"
              hidden
            >

              <button
                class="star-draw__button"
                id="starRedoButton"
                type="button"
              >
                redo
              </button>

              <button
                class="star-draw__button star-draw__button--primary"
                id="starSaveButton"
                type="button"
              >
                save to my universe
              </button>

            </div>

          </div>
        </div>


        <!-- ================================================================
             COLLECTION
             ================================================================ -->

        <div
          class="star-draw__view"
          id="starCollectionView"
          hidden
        >
          <p class="star-draw__eyebrow">
            things you've made
          </p>

          <h2 class="star-draw__script-title">
            your universe
          </h2>

          <div
            class="star-draw__collection-grid"
            id="starCollectionGrid"
          ></div>

          <p
            class="star-draw__empty"
            id="starCollectionEmpty"
          >
            nothing here yet. go draw something!
          </p>

          <div class="star-draw__actions">

            <button
              class="star-draw__button star-draw__button--primary"
              id="starDrawAnotherButton"
              type="button"
            >
              + draw another
            </button>

          </div>
        </div>


        <!-- ================================================================
             SAVED DRAWING PREVIEW
             ================================================================ -->

        <div
          class="star-draw__view"
          id="starPreviewView"
          hidden
        >

          <button
            class="star-draw__button"
            id="starPreviewBack"
            type="button"
          >
            ← back to collection
          </button>

          <h2 class="star-draw__script-title">
            saved star
          </h2>

          <canvas
            class="star-draw__preview-canvas"
            id="starPreviewCanvas"
            width="640"
            height="480"
          ></canvas>

        </div>

      </section>
    </div>
  `;


  /* Add component to every page */

  document.body.appendChild(root);


  /* --------------------------------------------------------------------------
     ELEMENTS
     -------------------------------------------------------------------------- */

  const launcher =
    document.getElementById(
      'starDrawLauncher'
    );

  const overlay =
    document.getElementById(
      'starDrawOverlay'
    );

  const modalClose =
    document.getElementById(
      'starModalClose'
    );


  const introView =
    document.getElementById(
      'starIntroView'
    );

  const cameraView =
    document.getElementById(
      'starCameraView'
    );

  const collectionView =
    document.getElementById(
      'starCollectionView'
    );

  const previewView =
    document.getElementById(
      'starPreviewView'
    );


  const startButton =
    document.getElementById(
      'starStartButton'
    );

  const viewUniverseButton =
    document.getElementById(
      'starViewUniverseButton'
    );


  const cameraPermission =
    document.getElementById(
      'starCameraPermission'
    );

  const cameraReset =
    document.getElementById(
      'starCameraReset'
    );

  const drawingActions =
    document.getElementById(
      'starDrawingActions'
    );

  const redoButton =
    document.getElementById(
      'starRedoButton'
    );

  const saveButton =
    document.getElementById(
      'starSaveButton'
    );

  const status =
    document.getElementById(
      'starDrawStatus'
    );


  const collectionGrid =
    document.getElementById(
      'starCollectionGrid'
    );

  const collectionEmpty =
    document.getElementById(
      'starCollectionEmpty'
    );

  const drawAnotherButton =
    document.getElementById(
      'starDrawAnotherButton'
    );


  const previewCanvas =
    document.getElementById(
      'starPreviewCanvas'
    );

  const previewCtx =
    previewCanvas.getContext('2d');

  const previewBack =
    document.getElementById(
      'starPreviewBack'
    );


  /* --------------------------------------------------------------------------
     MODAL VIEWS
     -------------------------------------------------------------------------- */

  function showView(view) {
    [
      introView,
      cameraView,
      collectionView,
      previewView,
    ].forEach((item) => {
      item.hidden =
        item !== view;
    });
  }


  function updateUniverseButton() {
    viewUniverseButton.hidden =
      savedDrawings.length === 0;
  }


  function openDrawingModal() {
    overlay.hidden =
      false;

    document.body.classList.add(
      'star-draw-is-open'
    );

    resetCurrentDrawing();

    updateUniverseButton();

    showView(
      introView
    );
  }


  function showCollection() {
    stopCamera();

    renderCollection();

    showView(
      collectionView
    );
  }


  function closeModal() {
    overlay.hidden =
      true;

    document.body.classList.remove(
      'star-draw-is-open'
    );

    stopCamera();
  }


  /* --------------------------------------------------------------------------
     MEDIAPIPE
     -------------------------------------------------------------------------- */

  async function createHandLandmarker() {
    if (handLandmarker) {
      return;
    }


    const vision =
      await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );


    handLandmarker =
      await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',

            delegate: 'GPU',
          },

          runningMode: 'VIDEO',

          numHands: 1,
        }
      );
  }


  /* --------------------------------------------------------------------------
     CAMERA
     -------------------------------------------------------------------------- */

  async function startCamera() {
    resetCurrentDrawing();

    showView(
      cameraView
    );


    video =
      document.getElementById(
        'starWebcam'
      );

    canvas =
      document.getElementById(
        'starDrawingCanvas'
      );

    ctx =
      canvas.getContext('2d');


    drawingActions.hidden =
      true;


    cameraPermission.hidden =
      false;


    status.textContent =
      'waiting for camera permission...';


    try {
      /*
        Start the camera permission request and
        MediaPipe download at the SAME time.

        That means Safari can show its camera
        prompt immediately instead of making
        the user wait for MediaPipe first.
      */

      const cameraPromise =
        navigator.mediaDevices.getUserMedia({
          video: {
            width: {
              ideal: 1280,
            },

            height: {
              ideal: 720,
            },
          },
        });


      const mediaPipePromise =
        createHandLandmarker();


      /*
        Wait for the user to allow the camera.
      */

      cameraStream =
        await cameraPromise;


      video.srcObject =
        cameraStream;


      await video.play();


      /*
        Camera is now visible.
        Hide the blue permission message.
      */

      cameraPermission.hidden =
        true;


      /*
        MediaPipe may still be finishing its
        first-time download.
      */

      status.textContent =
        'setting up hand tracking...';


      await mediaPipePromise;


      cameraStarted =
        true;

      lastVideoTime =
        -1;


      status.textContent =
        'point your index finger to draw ☝️';


      predictWebcam();

    } catch (error) {
      console.error(
        'Star drawing camera error:',
        error
      );


      cameraPermission.hidden =
        true;


      status.textContent =
        'camera access is needed to draw. check your browser camera permissions and try again.';


      stopCamera();
    }
  }


  function stopCamera() {
    cameraStarted =
      false;


    if (animationFrameId) {
      cancelAnimationFrame(
        animationFrameId
      );

      animationFrameId =
        null;
    }


    if (cameraStream) {
      cameraStream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });


      cameraStream =
        null;
    }


    if (video) {
      video.srcObject =
        null;
    }
  }


  function predictWebcam() {
    if (
      !cameraStarted ||
      !video ||
      !handLandmarker
    ) {
      return;
    }


    if (
      video.currentTime !==
      lastVideoTime
    ) {
      lastVideoTime =
        video.currentTime;


      const results =
        handLandmarker.detectForVideo(
          video,
          performance.now()
        );


      processHand(
        results
      );
    }


    animationFrameId =
      requestAnimationFrame(
        predictWebcam
      );
  }


  /* --------------------------------------------------------------------------
     MAIN HAND LOGIC
     -------------------------------------------------------------------------- */

  function processHand(results) {
    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );


    drawCurrentTrail();


    if (drawingFinished) {
      status.textContent =
        'drawing complete! ✦';

      return;
    }


    /* NO HAND */

    if (
      !results.landmarks ||
      results.landmarks.length === 0
    ) {
      handleMissingHand();

      resetPointing();

      palmStartTime =
        null;

      return;
    }


    /* HAND FOUND */

    hasSeenHand =
      true;

    handLostStartTime =
      null;


    const landmarks =
      results.landmarks[0];


    const indexOpen =
      fingerIsExtended(
        landmarks,
        8,
        6
      );

    const middleOpen =
      fingerIsExtended(
        landmarks,
        12,
        10
      );

    const ringOpen =
      fingerIsExtended(
        landmarks,
        16,
        14
      );

    const pinkyOpen =
      fingerIsExtended(
        landmarks,
        20,
        18
      );


    /* OPEN PALM = FINISH */

    const palmOpen =
      indexOpen &&
      middleOpen &&
      ringOpen &&
      pinkyOpen;


    if (
      palmOpen &&
      drawingPoints.length >= 3
    ) {
      resetPointing();

      handleOpenPalm();

      return;
    }


    palmStartTime =
      null;


    /* INDEX ONLY = DRAW */

    const pointing =
      indexOpen &&
      !middleOpen &&
      !ringOpen &&
      !pinkyOpen;


    if (pointing) {
      handlePointing(
        landmarks
      );

      return;
    }


    /* OTHER HAND POSE */

    status.textContent =
      'point your index finger to draw ☝️';


    resetPointing();
  }


  /* --------------------------------------------------------------------------
     LOST HAND / LIGHTING HELP
     -------------------------------------------------------------------------- */

  function handleMissingHand() {
    if (!hasSeenHand) {
      status.textContent =
        'show me your hand ☝️';

      return;
    }


    if (
      handLostStartTime === null
    ) {
      handLostStartTime =
        performance.now();
    }


    const missingFor =
      performance.now() -
      handLostStartTime;


    if (
      missingFor <
      HAND_LOST_WARNING_TIME
    ) {
      status.textContent =
        'looking for your hand...';

      return;
    }


    status.textContent =
      'having trouble seeing your hand. try moving away from bright backlighting or into more even lighting.';
  }


  /* --------------------------------------------------------------------------
     POINT + HOLD TO BEGIN
     -------------------------------------------------------------------------- */

  function handlePointing(
    landmarks
  ) {
    const indexTip =
      landmarks[8];


    const x =
      (1 - indexTip.x) *
      canvas.width;

    const y =
      indexTip.y *
      canvas.height;


    /* Already drawing */

    if (drawingActive) {
      drawWithIndexFinger(
        x,
        y
      );

      return;
    }


    /* Start hold timer */

    if (
      pointStartTime === null ||
      pointStartPosition === null
    ) {
      pointStartTime =
        performance.now();


      pointStartPosition = {
        x,
        y,
      };


      status.textContent =
        'hold your finger still... ☝️';

      return;
    }


    const movement =
      getDistance(
        x,
        y,
        pointStartPosition.x,
        pointStartPosition.y
      );


    /*
      Finger moved too far while waiting.
      Restart the timer.
    */

    if (
      movement >
      POINT_STILL_THRESHOLD
    ) {
      pointStartTime =
        performance.now();


      pointStartPosition = {
        x,
        y,
      };


      status.textContent =
        'hold your finger still... ☝️';

      return;
    }


    const elapsed =
      performance.now() -
      pointStartTime;


    const remaining =
      Math.max(
        0,
        POINT_HOLD_TIME -
        elapsed
      ) / 1000;


    status.textContent =
      `hold still... ${remaining.toFixed(1)}s`;


    /* Start drawing */

    if (
      elapsed >=
      POINT_HOLD_TIME
    ) {
      drawingActive =
        true;

      lastPoint =
        null;


      drawWithIndexFinger(
        x,
        y
      );
    }
  }


  /* --------------------------------------------------------------------------
     DRAWING
     -------------------------------------------------------------------------- */

  function drawWithIndexFinger(
    x,
    y
  ) {
    status.textContent =
      'drawing ✦ open your palm when finished';


    if (!lastPoint) {
      drawingPoints.push({
        x,
        y,
      });


      lastPoint = {
        x,
        y,
      };

    } else {
      const distance =
        getDistance(
          x,
          y,
          lastPoint.x,
          lastPoint.y
        );


      if (
        distance >=
        STAR_SPACING
      ) {
        drawingPoints.push({
          x,
          y,
        });


        lastPoint = {
          x,
          y,
        };
      }
    }


    /* Big current-fingertip star */

    drawStar(
      ctx,
      x,
      y,
      30
    );
  }


  function drawCurrentTrail() {
    if (!ctx) {
      return;
    }


    drawingPoints.forEach(
      (point) => {
        drawStar(
          ctx,
          point.x,
          point.y,
          19
        );
      }
    );
  }


  function drawStar(
    targetCtx,
    x,
    y,
    size
  ) {
    targetCtx.font =
      `${size}px Apple Color Emoji`;

    targetCtx.textAlign =
      'center';

    targetCtx.textBaseline =
      'middle';


    targetCtx.fillText(
      '⭐',
      x,
      y
    );
  }


  /* --------------------------------------------------------------------------
     OPEN PALM TO FINISH
     -------------------------------------------------------------------------- */

  function handleOpenPalm() {
    if (
      palmStartTime === null
    ) {
      palmStartTime =
        performance.now();
    }


    const elapsed =
      performance.now() -
      palmStartTime;


    status.textContent =
      'hold palm open to finish 🖐️';


    if (
      elapsed >=
      PALM_HOLD_TIME
    ) {
      drawingFinished =
        true;

      drawingActive =
        false;

      lastPoint =
        null;


      status.textContent =
        'drawing complete! ✦';


      drawingActions.hidden =
        false;
    }
  }


  /* --------------------------------------------------------------------------
     RESET / REDO
     -------------------------------------------------------------------------- */

  function resetCurrentDrawing() {
    drawingPoints =
      [];

    lastPoint =
      null;

    drawingFinished =
      false;

    drawingActive =
      false;

    pointStartTime =
      null;

    pointStartPosition =
      null;

    palmStartTime =
      null;

    handLostStartTime =
      null;

    hasSeenHand =
      false;


    if (
      ctx &&
      canvas
    ) {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }


    if (drawingActions) {
      drawingActions.hidden =
        true;
    }


    if (
      cameraStarted &&
      status
    ) {
      status.textContent =
        'point your index finger to draw ☝️';
    }
  }


  function resetPointing() {
    pointStartTime =
      null;

    pointStartPosition =
      null;

    drawingActive =
      false;

    lastPoint =
      null;
  }


  /* --------------------------------------------------------------------------
     SAVE
     -------------------------------------------------------------------------- */

  function saveDrawing() {
    if (
      drawingPoints.length === 0
    ) {
      return;
    }


    const drawing = {
      id: Date.now(),

      points:
        drawingPoints.map(
          (point) => ({
            x: point.x,
            y: point.y,
          })
        ),
    };


    savedDrawings.push(
      drawing
    );


    saveDrawingsToStorage();

    updateUniverseButton();

    stopCamera();


    /*
      Instead of closing abruptly,
      immediately show the updated universe.
    */

    renderCollection();

    showView(
      collectionView
    );
  }


  /* --------------------------------------------------------------------------
     STORAGE
     -------------------------------------------------------------------------- */

  function loadSavedDrawings() {
    try {
      return (
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          )
        ) || []
      );

    } catch {
      return [];
    }
  }


  function saveDrawingsToStorage() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        savedDrawings
      )
    );
  }


  /* --------------------------------------------------------------------------
     COLLECTION
     -------------------------------------------------------------------------- */

  function renderCollection() {
    collectionGrid.innerHTML =
      '';


    collectionEmpty.hidden =
      savedDrawings.length > 0;


    savedDrawings.forEach(
      (drawing) => {

        const card =
          document.createElement(
            'article'
          );


        card.className =
          'star-draw__collection-card';


        /* OPEN DRAWING */

        const previewButton =
          document.createElement(
            'button'
          );


        previewButton.type =
          'button';


        previewButton.className =
          'star-draw__collection-preview';


        previewButton.setAttribute(
          'aria-label',
          'Open saved drawing'
        );


        const thumb =
          document.createElement(
            'canvas'
          );


        thumb.width =
          180;

        thumb.height =
          150;


        drawPointsOnCanvas(
          drawing.points,
          thumb.getContext('2d'),
          thumb.width,
          thumb.height
        );


        previewButton.appendChild(
          thumb
        );


        previewButton.addEventListener(
          'click',
          () => {
            openPreview(
              drawing
            );
          }
        );


        /* DELETE DRAWING */

        const deleteButton =
          document.createElement(
            'button'
          );


        deleteButton.type =
          'button';


        deleteButton.className =
          'star-draw__delete';


        deleteButton.textContent =
          '×';


        deleteButton.setAttribute(
          'aria-label',
          'Delete drawing'
        );


        deleteButton.addEventListener(
          'click',
          (event) => {
            event.stopPropagation();


            deleteDrawing(
              drawing.id
            );
          }
        );


        card.appendChild(
          previewButton
        );


        card.appendChild(
          deleteButton
        );


        collectionGrid.appendChild(
          card
        );
      }
    );
  }


  function deleteDrawing(id) {
    const confirmed =
      window.confirm(
        'delete this drawing? this cannot be undone.'
      );


    if (!confirmed) {
      return;
    }


    savedDrawings =
      savedDrawings.filter(
        (drawing) =>
          drawing.id !== id
      );


    saveDrawingsToStorage();

    updateUniverseButton();

    renderCollection();
  }


  /* --------------------------------------------------------------------------
     SAVED DRAWING PREVIEW
     -------------------------------------------------------------------------- */

  function openPreview(
    drawing
  ) {
    previewCtx.clearRect(
      0,
      0,
      previewCanvas.width,
      previewCanvas.height
    );


    drawPointsOnCanvas(
      drawing.points,
      previewCtx,
      previewCanvas.width,
      previewCanvas.height
    );


    showView(
      previewView
    );
  }


  /* --------------------------------------------------------------------------
     CROPPED DRAWING RENDERING
     -------------------------------------------------------------------------- */

  function drawPointsOnCanvas(
    points,
    targetCtx,
    targetWidth,
    targetHeight
  ) {
    targetCtx.clearRect(
      0,
      0,
      targetWidth,
      targetHeight
    );


    if (
      !points ||
      points.length === 0
    ) {
      return;
    }


    let minX =
      Infinity;

    let minY =
      Infinity;

    let maxX =
      -Infinity;

    let maxY =
      -Infinity;


    points.forEach(
      (point) => {

        minX =
          Math.min(
            minX,
            point.x
          );


        minY =
          Math.min(
            minY,
            point.y
          );


        maxX =
          Math.max(
            maxX,
            point.x
          );


        maxY =
          Math.max(
            maxY,
            point.y
          );
      }
    );


    const sourcePadding =
      20;


    minX -=
      sourcePadding;

    minY -=
      sourcePadding;

    maxX +=
      sourcePadding;

    maxY +=
      sourcePadding;


    const drawingWidth =
      Math.max(
        1,
        maxX -
        minX
      );


    const drawingHeight =
      Math.max(
        1,
        maxY -
        minY
      );


    const targetPadding =
      14;


    const availableWidth =
      targetWidth -
      targetPadding * 2;


    const availableHeight =
      targetHeight -
      targetPadding * 2;


    const scale =
      Math.min(
        availableWidth /
          drawingWidth,

        availableHeight /
          drawingHeight
      );


    const offsetX =
      (
        targetWidth -
        drawingWidth *
          scale
      ) / 2;


    const offsetY =
      (
        targetHeight -
        drawingHeight *
          scale
      ) / 2;


    const starSize =
      Math.max(
        5,
        19 * scale
      );


    points.forEach(
      (point) => {

        const drawX =
          (
            point.x -
            minX
          ) *
          scale +
          offsetX;


        const drawY =
          (
            point.y -
            minY
          ) *
          scale +
          offsetY;


        drawStar(
          targetCtx,
          drawX,
          drawY,
          starSize
        );
      }
    );
  }


  /* --------------------------------------------------------------------------
     HELPERS
     -------------------------------------------------------------------------- */

  function fingerIsExtended(
    landmarks,
    tipIndex,
    jointIndex
  ) {
    const wrist =
      landmarks[0];


    const tip =
      landmarks[
        tipIndex
      ];


    const joint =
      landmarks[
        jointIndex
      ];


    const tipDistance =
      getDistance(
        wrist.x,
        wrist.y,
        tip.x,
        tip.y
      );


    const jointDistance =
      getDistance(
        wrist.x,
        wrist.y,
        joint.x,
        joint.y
      );


    return (
      tipDistance >
      jointDistance *
        1.15
    );
  }


  function getDistance(
    x1,
    y1,
    x2,
    y2
  ) {
    return Math.sqrt(
      Math.pow(
        x2 -
        x1,
        2
      ) +

      Math.pow(
        y2 -
        y1,
        2
      )
    );
  }


  /* --------------------------------------------------------------------------
     EVENTS
     -------------------------------------------------------------------------- */

  launcher.addEventListener(
    'click',
    openDrawingModal
  );

    /* Any element with data-star-draw-open (e.g. the home page experiment
     card) opens the same modal as the launcher button. */
  document.querySelectorAll('[data-star-draw-open]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      openDrawingModal();
    });
  });


  modalClose.addEventListener(
    'click',
    closeModal
  );


  startButton.addEventListener(
    'click',
    startCamera
  );


  viewUniverseButton.addEventListener(
    'click',
    showCollection
  );


  cameraReset.addEventListener(
    'click',
    resetCurrentDrawing
  );


  redoButton.addEventListener(
    'click',
    resetCurrentDrawing
  );


  saveButton.addEventListener(
    'click',
    saveDrawing
  );


  drawAnotherButton.addEventListener(
    'click',
    () => {

      resetCurrentDrawing();

      updateUniverseButton();

      showView(
        introView
      );
    }
  );


  previewBack.addEventListener(
    'click',
    () => {

      renderCollection();

      showView(
        collectionView
      );
    }
  );


  /* Click outside modal */

  overlay.addEventListener(
    'click',
    (event) => {

      if (
        event.target ===
        overlay
      ) {
        closeModal();
      }
    }
  );


  /* Escape closes modal */

  document.addEventListener(
    'keydown',
    (event) => {

      if (
        event.key ===
          'Escape' &&
        !overlay.hidden
      ) {
        closeModal();
      }
    }
  );


  /* --------------------------------------------------------------------------
     INITIAL STATE
     -------------------------------------------------------------------------- */

  updateUniverseButton();
})();