import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let selectedFolder;
let videoFiles = [];
let dateTimes = new Set();
let ffmpeg;

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
    dateTimes.clear();
    const fileList = document.getElementById('fileList');
    const dateSelector = document.getElementById('dateSelector');
    fileList.innerHTML = '';
    dateSelector.innerHTML = '<option value="">Select a date and time</option>';

    for await (const entry of folder.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.mp4')) {
            videoFiles.push(entry);
            const li = document.createElement('li');
            li.textContent = entry.name;
            fileList.appendChild(li);

            // Extract date and time from filename
            const match = entry.name.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
            if (match) {
                dateTimes.add(match[1]);
            }
        }
    }

    // Populate date selector
    Array.from(dateTimes).sort().forEach(dateTime => {
        const option = document.createElement('option');
        option.value = dateTime;
        option.textContent = dateTime.replace('_', ' ').replace(/-/g, ':');
        dateSelector.appendChild(option);
    });
}

async function loadVideos() {
    if (!selectedFolder) {
        alert('Please select a folder first.');
        return;
    }

    const dateTime = document.getElementById('dateSelector').value;
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

async function initFFmpeg() {
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        ffmpeg.on('log', ({ message }) => {
            document.getElementById('ffmpegMessage').innerHTML = message;
            console.log(message);
        });
        const baseURL = '/ffmpeg'; // Assuming you'll put ffmpeg files in a folder named 'ffmpeg' in your public directory
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
    }
}

async function combineAndExport() {
    try {
        await initFFmpeg();

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
            await ffmpeg.writeFile(`input${i}.mp4`, await fetchFile(streams[i]));
        }

        await ffmpeg.exec([
            '-i', 'input0.mp4', '-i', 'input1.mp4', '-i', 'input2.mp4', '-i', 'input3.mp4',
            '-filter_complex', '[0:v][1:v][2:v][3:v]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0[v]',
            '-map', '[v]', 'output.mp4'
        ]);

        const data = await ffmpeg.readFile('output.mp4');
        const combinedVideo = new Blob([data.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(combinedVideo);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'combined_dashcam.mp4';
        a.click();
    } catch (error) {
        console.error('Error in combineAndExport:', error);
        alert('An error occurred while combining and exporting the videos. Please check the console for details.');
    }
}

// Initialize FFmpeg when the page loads
initFFmpeg();