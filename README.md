# CrappyBitsVideoQueue

## Crappy js code that allows users to play videos using bits.

## Installation. 

**Download Node.js**

Ensure that Node.js is installed on your machine.
It includes the `fs` and `path` modules needed for this script.

**Install Dependencies**

Open your terminal and run the following command to install the required modules:
   ```
    npm install tmi.js js-yaml ytdl-core puppeteer
   ```

## Usage. 

**Configure the Script**   

Headover to config.yaml to configure.

**Example:**
   ```
    channel: uni1g
    bitsPerSec: 10
    maxVideoLength: 3600 
   ```

## Moderator commands

**!play**

   Instantly switches to the given video, the video will instatly skipped by the queue.
    example:
   - `!play https://www.youtube.com/watch?v=uaui_lt5LtQ`

**!queue**

   Adds a video to the queue.
    example:
   - `!queue https://www.youtube.com/watch?v=uaui_lt5LtQ`
     
**!skip**

   Skips the current video.
     
**!pause**

   Pauses the queue (not the video).
