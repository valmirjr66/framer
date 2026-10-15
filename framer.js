const FRAME_SIZE = 1080;

let cropper;
let frameImg;
let selectedTemplateId = null;
let photoDataUrl = null;
let downloadObjectUrl = null;

const TEMPLATES = [
    { id: 'classic', name: 'Classic', draw: drawClassicFrame },
    { id: 'modern', name: 'Modern', draw: drawModernFrame },
    { id: 'bold', name: 'Bold', draw: drawBoldFrame },
];

window.onload = () => {
    renderTemplates();
    document.getElementById('photo-input').addEventListener('change', onPhotoSelected);
    document.getElementById('next-template-btn').addEventListener('click', goToPhoto);
    document.getElementById('back-photo-btn').addEventListener('click', goToTemplate);
    document.getElementById('next-photo-btn').addEventListener('click', goToCrop);
    document.getElementById('back-crop-btn').addEventListener('click', goToPhoto);
    document.getElementById('finish-btn').addEventListener('click', goToFinish);
    document.getElementById('restart-btn').addEventListener('click', startOver);
    setActiveStep(1);
};

function drawClassicFrame(ctx, s) {
    const banner = s * 0.12;
    const outer = s * 0.017;
    const gold = s * 0.026;
    const inner = s * 0.067;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#1a4d2e';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(outer, outer, s - outer * 2, s - outer * 2);
    ctx.fillStyle = '#1a4d2e';
    ctx.fillRect(outer + gold, outer + gold, s - (outer + gold) * 2, s - (outer + gold) * 2);
    ctx.clearRect(inner, inner, s - inner * 2, s - inner - banner);
    ctx.fillStyle = '#1a4d2e';
    ctx.fillRect(0, s - banner, s, banner);
    ctx.fillStyle = '#d4af37';
    ctx.font = `700 ${Math.round(s * 0.052)}px Montserrat, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIRA VOTO', s / 2, s - banner / 2);
}

function drawModernFrame(ctx, s) {
    const banner = s * 0.1;
    const inset = s * 0.045;
    const len = s * 0.083;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, s, s);
    ctx.clearRect(inset, inset, s - inset * 2, s - inset - banner);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, s * 0.009);
    const top = inset;
    const bottom = s - banner;
    [
        [inset, top, 1, 1],
        [s - inset, top, -1, 1],
        [inset, bottom, 1, -1],
        [s - inset, bottom, -1, -1],
    ].forEach(([x, y, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * len);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * len, y);
        ctx.stroke();
    });
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, s - banner, s, banner);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(s * 0.041)}px Montserrat, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIRA VOTO', s / 2, s - banner / 2);
}

function drawBoldFrame(ctx, s) {
    const banner = s * 0.12;
    const green = s * 0.02;
    const yellow = s * 0.037;
    const blue = s * 0.057;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = '#009c3b';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#ffdf00';
    ctx.fillRect(green, green, s - green * 2, s - green * 2);
    ctx.fillStyle = '#002776';
    ctx.fillRect(yellow, yellow, s - yellow * 2, s - yellow * 2);
    ctx.clearRect(blue, blue, s - blue * 2, s - blue - banner);
    ctx.fillStyle = '#009c3b';
    ctx.fillRect(0, s - banner, s, banner);
    ctx.fillStyle = '#ffdf00';
    ctx.font = `700 ${Math.round(s * 0.052)}px Montserrat, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIRA VOTO', s / 2, s - banner / 2);
}

function createFrameImage(drawFn, size = FRAME_SIZE) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    drawFn(canvas.getContext('2d'), size);
    const img = new Image();
    return new Promise((resolve) => {
        img.onload = () => resolve(img);
        img.src = canvas.toDataURL('image/png');
    });
}

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
        canvas.width = 220;
        canvas.height = 220;
        canvas.className = 'template-preview';
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ddd';
        ctx.fillRect(0, 0, 220, 220);
        ctx.fillStyle = '#bbb';
        ctx.font = '16px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Your photo', 110, 100);
        template.draw(ctx, 220);

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
    updateStepButtons();
}

function onPhotoSelected(event) {
    const file = event.target.files && event.target.files[0];
    const nameEl = document.getElementById('photo-name');
    const preview = document.getElementById('photo-preview');

    if (!file) {
        photoDataUrl = null;
        nameEl.textContent = 'No photo selected';
        preview.hidden = true;
        preview.removeAttribute('src');
        updateStepButtons();
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        photoDataUrl = e.target.result;
        nameEl.textContent = file.name;
        preview.src = photoDataUrl;
        preview.hidden = false;
        updateStepButtons();
    };
    reader.readAsDataURL(file);
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

async function goToCrop() {
    if (!selectedTemplateId || !photoDataUrl) {
        return;
    }

    const template = TEMPLATES.find((item) => item.id === selectedTemplateId);
    frameImg = await createFrameImage(template.draw);

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
        width: FRAME_SIZE,
        height: FRAME_SIZE,
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
    photoDataUrl = null;
    frameImg = null;
    document.getElementById('photo-input').value = '';
    document.getElementById('photo-name').textContent = 'No photo selected';
    const preview = document.getElementById('photo-preview');
    preview.hidden = true;
    preview.removeAttribute('src');
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
