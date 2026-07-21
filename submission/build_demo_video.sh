#!/bin/zsh
set -euo pipefail

FFMPEG=/Users/kishorekumar/.local/bin/ffmpeg
ROOT=/Users/kishorekumar/upGradVerse
WORK="$ROOT/submission/video_work"
SHOTS="$ROOT/submission/screenshots"

mkdir -p "$WORK"

still_segment() {
  local input="$1"
  local duration="$2"
  local frames="$3"
  local fadeout="$4"
  local output="$5"
  "$FFMPEG" -y -hide_banner -loglevel error -loop 1 -i "$input" -t "$duration" \
    -vf "scale=1920:1080,zoompan=z='1+on*0.00005':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1920x1080:fps=60,fade=t=in:st=0:d=0.28,fade=t=out:st=${fadeout}:d=0.28" \
    -an -c:v h264_videotoolbox -b:v 12M -pix_fmt yuv420p "$output"
}

live_segment() {
  local input="$1"
  local duration="$2"
  local fadeout="$3"
  local output="$4"
  "$FFMPEG" -y -hide_banner -loglevel error -i "$input" -t "$duration" \
    -filter_complex "[0:v]split=2[bg][fg];[bg]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,gblur=sigma=26[blur];[fg]scale=1920:1080:force_original_aspect_ratio=decrease[front];[blur][front]overlay=(W-w)/2:(H-h)/2,fade=t=in:st=0:d=0.28,fade=t=out:st=${fadeout}:d=0.28[v]" \
    -map "[v]" -an -r 60 -c:v h264_videotoolbox -b:v 12M -pix_fmt yuv420p "$output"
}

still_segment "$SHOTS/01-cover-16x9.png" 5 300 4.72 "$WORK/01.mp4"
live_segment "$ROOT/submission/video-world.mp4" 10 9.72 "$WORK/02.mp4"
still_segment "$SHOTS/07-character-selector-kish.png" 7 420 6.72 "$WORK/03.mp4"
still_segment "$SHOTS/08-upgrad-skillshop.png" 8 480 7.72 "$WORK/04.mp4"
still_segment "$SHOTS/08-upgrad-data-mission.png" 7 420 6.72 "$WORK/05.mp4"
still_segment "$SHOTS/05-chatgpt-skillshop.png" 7 420 6.72 "$WORK/06.mp4"
still_segment "$SHOTS/06-claude-studio.png" 7 420 6.72 "$WORK/07.mp4"
still_segment "$SHOTS/04-driving.png" 6 360 5.72 "$WORK/08.mp4"
still_segment "$SHOTS/09-fight-ring-world.png" 6 360 5.72 "$WORK/09.mp4"

"$FFMPEG" -y -hide_banner -loglevel error -f concat -safe 0 -i "$ROOT/submission/video-concat.txt" -c copy "$WORK/picture.mp4"

"$FFMPEG" -y -hide_banner -loglevel error \
  -i "$WORK/picture.mp4" \
  -i "$ROOT/submission/video-narration.aiff" \
  -stream_loop -1 -i "$ROOT/public/assets/audio/everything-i-hate-punk-vocal.mp3" \
  -filter_complex "[1:a]volume=1.22,highpass=f=75,lowpass=f=13500[vo];[2:a]volume=.055[bg];[vo][bg]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=.94[a]" \
  -map 0:v -map "[a]" -shortest -c:v copy -c:a aac -b:a 192k -movflags +faststart \
  "$ROOT/submission/upgradverse-build-week-demo.mp4"
