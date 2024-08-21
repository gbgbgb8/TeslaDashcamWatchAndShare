let selectedFolder;
let videoFiles = [];

document.getElementById('selectFolder').addEventListener('click', async () => {
    try {
        selectedFolder = await window.showDirectoryPicker();
        await listFiles(selectedFolder);
    } catch (err) {
        console.error('Error selecting folder:', err);
    }
});

async function listFiles(folder) {
    videoFiles = [];
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    for await (const entry of folder.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.mp4')) {
            videoFiles.push(entry);
            const li = document.createElement('li');
            li.textContent = entry.name;
            fileList.appendChild(li);
        }
    }
}

async function loadVideos() {
    if (!selectedFolder) {
        alert('Please select a folder first.');
        return;
    }

    const dateTime = document.getElementById('dateTimePicker').value;
    if (!dateTime) {
        alert('Please select a date and time.');
        return;
    }

    const formattedDateTime = dateTime.replace('T', '_').replace(/:/g, '-');
    const cameras = ['front', 'back', 'left_repeater', 'right_repeater'];

    for (const camera of cameras) {
        const video = document.getElementById(`${camera.split('_')[0]}Video`);
        const fileName = `${formattedDateTime}-${camera}.mp4`;
        const file = videoFiles.find(f => f.name === fileName);

        if (file) {
            const fileHandle = await selectedFolder.getFileHandle(fileName);
            const fileData = await fileHandle.getFile();
            video.src = URL.createObjectURL(fileData);
        } else {
            video.src = '';
        }
    }
}

let ffmpeg;

async function initFFmpeg() {
    ffmpeg = createFFmpeg({ log: true });
    await ffmpeg.load();
}

// Call this function when the page loads
initFFmpeg();

async function combineAndExport() {
    if (!ffmpeg) {
        alert('FFmpeg is not initialized. Please try again in a moment.');
        return;
    }

    const videos = document.querySelectorAll('video');
    const streams = [];

    for (const video of videos) {
        if (video.src) {
            const response = await fetch(video.src);
            const blob = await response.blob();
            streams.push(blob);
        }
    }

    if (streams.length === 0) {
        alert('No videos loaded to combine.');
        return;
    }

    for (let i = 0; i < streams.length; i++) {
        ffmpeg.FS('writeFile', `input${i}.mp4`, await fetchFile(streams[i]));
    }

    await ffmpeg.run('-i', 'input0.mp4', '-i', 'input1.mp4', '-i', 'input2.mp4', '-i', 'input3.mp4', 
                     '-filter_complex', '[0:v][1:v][2:v][3:v]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]', 
                     '-map', '[v]', 'output.mp4');

    const data = ffmpeg.FS('readFile', 'output.mp4');
    const combinedVideo = new Blob([data.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(combinedVideo);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'combined_dashcam.mp4';
    a.click();
}