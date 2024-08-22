import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

async function init() {
    try {
        const ffmpeg = new FFmpeg();
        await ffmpeg.load();
        document.getElementById('status').textContent = 'FFmpeg loaded successfully!';
    } catch (error) {
        console.error('Error initializing FFmpeg:', error);
        document.getElementById('status').textContent = 'Failed to load FFmpeg. Check console for details.';
    }
}

init();