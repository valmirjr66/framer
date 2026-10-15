// Card previews scale with the viewport, so draw them above their usual size
const PREVIEW_SIZE = 360;

let cropper;
let frameImg;
let selectedTemplateId = null;
let photoDataUrl = null;
let downloadObjectUrl = null;

const TEMPLATES = [
    { id: 'juventude', name: 'Juventude Itaunense', src: 'assets/frames/frame1.png', sampleSrc: 'assets/people/person1.png' },
    { id: 'artistas', name: 'Artistas Itaunenses', src: 'assets/frames/frame2.png', sampleSrc: 'assets/people/person2.png' },
    { id: 'presidente', name: 'Presidente Lula 13', src: 'assets/frames/frame3.png', sampleSrc: 'assets/people/person3.png' },
];

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// CSS object-fit: cover, but for canvas
function drawImageCover(ctx, img, size) {
    const scale = Math.max(size / img.width, size / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

window.onload = async () => {
    // Canvas text needs the display face resolved before the first paint
    if (document.fonts) {
        await document.fonts.load('400 80px Anton');
        await document.fonts.ready;
    }
    await Promise.all(TEMPLATES.map(async (template) => {
        [template.img, template.sample] = await Promise.all([
            loadImage(template.src),
            loadImage(template.sampleSrc),
        ]);
    }));
    renderTemplates();
    document.getElementById('photo-input').addEventListener('change', onPhotoSelected);
    setUpDropzone();
    document.getElementById('next-template-btn').addEventListener('click', goToPhoto);
    document.getElementById('back-photo-btn').addEventListener('click', goToTemplate);
    document.getElementById('next-photo-btn').addEventListener('click', goToCrop);
    document.getElementById('back-crop-btn').addEventListener('click', goToPhoto);
    document.getElementById('finish-btn').addEventListener('click', goToFinish);
    document.getElementById('restart-btn').addEventListener('click', startOver);
    setActiveStep(1);
};

function renderTemplates() {
    const container = document.getElementById('templates');
    container.innerHTML = '';

    TEMPLATES.forEach((template) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'template-card';
        button.dataset.templateId = template.id;
        button.setAttribute('aria-pressed', 'false');

        const canvas = document.createElement('canvas');
        canvas.width = PREVIEW_SIZE;
        canvas.height = PREVIEW_SIZE;
        canvas.className = 'template-preview';
        const ctx = canvas.getContext('2d');
        ctx.drawImage(template.img, 0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

        // Sample photo goes underneath: the frames clear their photo window
        ctx.globalCompositeOperation = 'destination-over';
        drawImageCover(ctx, template.sample, PREVIEW_SIZE);
        ctx.globalCompositeOperation = 'source-over';

        const label = document.createElement('span');
        label.textContent = template.name;

        button.append(canvas, label);
        button.addEventListener('click', () => selectTemplate(template.id));
        container.appendChild(button);
    });
}

function selectTemplate(id) {
    selectedTemplateId = id;
    document.querySelectorAll('.template-card').forEach((card) => {
        const selected = card.dataset.templateId === id;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-pressed', String(selected));
    });
    const template = TEMPLATES.find((item) => item.id === id);
    document.getElementById('chosen-template-name').textContent = template ? template.name : '—';
    updateStepButtons();
}

function setUpDropzone() {
    const dropzone = document.getElementById('dropzone');

    ['dragenter', 'dragover'].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
            event.preventDefault();
            dropzone.classList.add('dragging');
        });
    });

    ['dragleave', 'dragend'].forEach((type) => {
        dropzone.addEventListener(type, (event) => {
            // Crossing a child element fires dragleave — ignore those
            if (type === 'dragleave' && dropzone.contains(event.relatedTarget)) {
                return;
            }
            dropzone.classList.remove('dragging');
        });
    });

    dropzone.addEventListener('drop', (event) => {
        event.preventDefault();
        dropzone.classList.remove('dragging');
        const file = event.dataTransfer.files && event.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadPhoto(file);
        }
    });
}

function onPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
        loadPhoto(file);
    } else {
        clearPhoto();
    }
}

function loadPhoto(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        photoDataUrl = e.target.result;
        document.getElementById('photo-name').textContent = file.name;
        const preview = document.getElementById('photo-preview');
        preview.src = photoDataUrl;
        preview.hidden = false;
        document.getElementById('dropzone').classList.add('has-photo');
        document.getElementById('dropzone-cta').textContent = 'Trocar foto';
        updateStepButtons();
    };
    reader.readAsDataURL(file);
}

function clearPhoto() {
    photoDataUrl = null;
    document.getElementById('photo-input').value = '';
    document.getElementById('photo-name').textContent = 'Nenhuma foto selecionada';
    const preview = document.getElementById('photo-preview');
    preview.hidden = true;
    preview.removeAttribute('src');
    const dropzone = document.getElementById('dropzone');
    dropzone.classList.remove('has-photo', 'dragging');
    document.getElementById('dropzone-cta').textContent = 'Selecionar foto';
    updateStepButtons();
}

function updateStepButtons() {
    document.getElementById('next-template-btn').disabled = !selectedTemplateId;
    document.getElementById('next-photo-btn').disabled = !photoDataUrl;
}

function setActiveStep(step) {
    document.querySelectorAll('.wizard-step').forEach((section, index) => {
        section.hidden = index + 1 !== step;
    });
    document.querySelectorAll('.step-label').forEach((label) => {
        label.classList.toggle('active', Number(label.dataset.step) === step);
        label.classList.toggle('done', Number(label.dataset.step) < step);
    });
}

function destroyCropper() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

function goToTemplate() {
    destroyCropper();
    setActiveStep(1);
}

function goToPhoto() {
    if (!selectedTemplateId) {
        return;
    }
    destroyCropper();
    setActiveStep(2);
}

function goToCrop() {
    if (!selectedTemplateId || !photoDataUrl) {
        return;
    }

    const template = TEMPLATES.find((item) => item.id === selectedTemplateId);
    frameImg = template.img;

    destroyCropper();
    setActiveStep(3);

    const image = document.getElementById('profile-pic');
    image.onload = () => {
        destroyCropper();
        cropper = new Cropper(image, {
            aspectRatio: frameImg.width / frameImg.height,
            viewMode: 1,
            zoomable: true,
            guides: true,
            background: false,
            autoCropArea: 0.9,
            toggleDragModeOnDblclick: false,
        });
    };
    image.src = '';
    image.src = photoDataUrl;
}

function goToFinish() {
    if (!cropper || !frameImg) {
        return;
    }

    const cropped = cropper.getCroppedCanvas({
        width: frameImg.naturalWidth,
        height: frameImg.naturalHeight,
        imageSmoothingQuality: 'high',
    });

    const canvas = document.getElementById('framed');
    const ctx = canvas.getContext('2d');
    canvas.width = frameImg.width;
    canvas.height = frameImg.height;
    ctx.drawImage(cropped, 0, 0, canvas.width, canvas.height);
    ctx.drawImage(frameImg, 0, 0);

    if (downloadObjectUrl) {
        URL.revokeObjectURL(downloadObjectUrl);
    }
    canvas.toBlob((blob) => {
        downloadObjectUrl = URL.createObjectURL(blob);
        const downloadBtn = document.getElementById('download-btn');
        downloadBtn.href = downloadObjectUrl;
        downloadBtn.download = 'vira-voto.png';
    }, 'image/png');

    destroyCropper();
    setActiveStep(4);
}

function startOver() {
    destroyCropper();
    selectedTemplateId = null;
    frameImg = null;
    clearPhoto();
    document.getElementById('chosen-template-name').textContent = '—';
    document.querySelectorAll('.template-card').forEach((card) => {
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
    });
    if (downloadObjectUrl) {
        URL.revokeObjectURL(downloadObjectUrl);
        downloadObjectUrl = null;
    }
    document.getElementById('download-btn').removeAttribute('href');
    updateStepButtons();
    setActiveStep(1);
}
