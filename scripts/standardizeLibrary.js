const { isDataView } = require('util/types');

// List any npm dependencies which the plugin needs, they will be auto installed when the plugin runs:
module.exports.dependencies = [
  'import-fresh',
];
const details = () => ({
  id: 'mstrhakr-standardizeLibrary-ffmpeg',
  Stage: 'Pre-processing',
  Name: 'mstrhakr-standardizeLibrary-ffmpeg',
  Type: 'Video',
  Operation: 'Transcode',
  Description: `Standardize Library by Resolution, Codec, and Container. Skips HEVC, VP9 and AV1 regardless of other conditions.`,
  Version: '0.1',
  Tags: 'pre-processing,ffmpeg,video only,configurable',
  Inputs: [
    {
      name: 'container',
      type: 'string',
      defaultValue: 'mkv',
      inputUI: {
        type: 'dropdown',
        options: [
          'mkv',
          'mp4'
        ],
      },
      tooltip: `Choose library standard container`,
    },
    {
      name: 'resolution',
      type: 'string',
      defaultValue: '1080p',
      inputUI: {
        type: 'dropdown',
        options: [
          '4KUHD',
          '1080p',
          '720p',
          '480p',
        ],
      },
      tooltip: `Choose library standard resolution.`,
    },
    {
      name: 'preset',
      type: 'string',
      defaultValue: 'fast',
      inputUI: {
        type: 'dropdown',
        options: [
          'faster',
          'fast',
          'medium',
          'slow',
          'slower',
        ],
      },
      tooltip: `Specify Handbrake Preset`,
    },
    {
      name: 'defaultBitrate',
      type: 'number',
      defaultValue: '0',
      inputUI: {
        type: 'string',
      },
      tooltip: `Choose library standard bitrate ±30% (for reducing resolution)`,
    },
    {
      name: 'targetBitrateDeviation',
      type: 'number',
      defaultValue: '.3',
      inputUI: {
        type: 'string',
      },
      tooltip: `Choose library standard bitrate deviation (e.g. ±30%, for reducing resolution)`,
    },
    {
      name: 'nvenc',
      type: 'boolean',
      defaultValue: true,
      inputUI: {
        type: 'dropdown',
        options: [
          'true',
          'false',
        ],
      },
      tooltip: `Use NVENC or CPU`,
    },
    {
      name: 'subtitleLanguages',
      type: 'string',
      defaultValue: 'eng',
      inputUI: {
        type: 'text',
      },
      tooltip: `Specify language tag/s here for the subtitle tracks you'd like to keep.
                      \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                 \\nExample:\\n
                 eng
  
                 \\nExample:\\n
                 eng,jpn`,
    },
    {
      name: 'subtitleTagLanguage',
      type: 'string',
      defaultValue: '',
      inputUI: {
        type: 'text',
      },
      tooltip: `Specify a single language for subtitle tracks with no language or unknown language to be tagged with.
                      \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                      \\nLeave empty to disable.
                 \\nExample:\\n
                 eng
  
                 \\nExample:\\n
                 jpn`,
    },
    {
      name: 'audioLanguages',
      type: 'string',
      defaultValue: 'eng',
      inputUI: {
        type: 'text',
      },
      tooltip: `Specify language tag/s here for the audio tracks you'd like to keep.
                      \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                 \\nExample:\\n
                 eng
  
                 \\nExample:\\n
                 eng,jpn`,
    },
    {
      name: 'audioTagLanguage',
      type: 'string',
      defaultValue: '',
      inputUI: {
        type: 'text',
      },
      tooltip: `Specify a single language for audio tracks with no language or unknown language to be tagged with.
                      \\nMust follow ISO-639-2 3 letter format. https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes
                      \\nLeave empty to disable.
                 \\nExample:\\n
                 eng
  
                 \\nExample:\\n
                 jpn`,
    },
  ],
});
// eslint-disable-next-line no-unused-vars
const plugin = (file, librarySettings, inputs, otherArguments) => {

  console.log(`'${file.meta.FileName}' START\n==============================\n`);
  console.log(`'file.meta' OBJECT START\n==============================\n${JSON.stringify(file.meta, null, 2)}\n==============================\n'file.meta' OBJECT END\n`);
  console.log(`'inputs' OBJECT START\n==============================\n${JSON.stringify(inputs, null, 2)}\n==============================\n'inputs' OBJECT END\n`);

  const lib = require('../methods/lib')();
  // eslint-disable-next-line no-unused-vars,no-param-reassign
  inputs = lib.loadDefaultValues(inputs, details);


  //Must return this object at some point
  const response = {
    processFile: false,
    preset: '',
    container: `.${inputs.container}`,
    handbrakeMode: false,
    ffmpegMode: true,
    reQueueAfter: true,
    infoLog: '',
  };

  let extraArguments = conform() + subtitles() + removeImageStreams()

  const Response = function () {
    console.log(JSON.stringify(response, null, 2));
    console.log(`\n==============================\n'${file.meta.FileName}' END\n`)
    return response;
  }


  let encoder = (inputs.nvenc == true) ? "h264_nvenc" : "x264";

  let standards = {
    resolution: {
      met: () => this.resolutionsList.indexOf(file.video_resolution) <= this.resolutionsList.indexOf(inputs.resolution),
      reason: function () {
        let reason = ''
        if (this.met) {
          reason += `already in ${inputs.resolution}`;
        } else {
          reason += `not in ${inputs.resolution}`;
        }
        if (this.unless) {
          reason += `, but is an excluded codec (${excludedCodecs.join(',')})`;
        }
        return reason;
      },
      resolutionsList: ['480p', '576p', '720p', '1080p', '4KUHD', 'DCI4K', '8KUHD'],
      resolutionsHeight: [480, 576, 720, 1080, 2160, 2160, 4320],
      wantedHeight: () => this.resolutionsHeight[this.resolutionsList.indexOf(inputs.resolution)],
      wantedWidth: () => this.height * (16 / 9),
      currentHeight: file.meta.ImageHeight,
      currentWidth: file.meta.ImageWidth,
      unless: standards.codec.isExcludedCodec,
    },
    codec: {
      met: () => file.video_codec_name == this.includedCodec,
      reason: function () {
        let reason = '';
        if (this.met) {
          reason += `already encoded in ${file.video_codec_name}`;
        } else {
          reason += `not encoded in ${this.includedCodec}`;
        }
        if (this.unless) {
          reason += `, but is an excluded codec (${this.excludedCodecs.join(',')})`;
        }
        return reason;
      },
      excludedCodecs: ['hevc', 'vp9', 'av1'],
      includedCodec: 'h264',
      isExcludedCodec: () => this.excludedCodecs.includes(file.video_codec_name),
      unless: () => this.isExcludedCodec,
    },
    bitrate: {
      met: () => inputs.targetBitrate == 0 ? this.checkBitrate(this.targetBitrate()) : true,
      reason: function () {
        if (inputs.targetBitrate == 0) {
          if (this.met === true) {
            return `already has an acceptable bitrate (${this.targetBitrate()}±${inputs.targetBitrateDeviation * 100}%)`;
          } else {
            return `does not have an acceptable bitrate(${this.targetBitrate()}±${inputs.targetBitrateDeviation * 100}%)`;

          }
        } else {
          return '(skipped bitrate check, using manual value)';
        }
      },
      defaultBitrate: () => inputs.defaultBitrate !== 0 ? inputs.defaultBitrate : standards.resolution.wantedHeight * 5,
      minimumBitrate: (bitrate) => Math.floor(bitrate * (1 - inputs.targetBitrateDeviation)),
      maximumBitrate: (bitrate) => Math.floor(bitrate * (1 + inputs.targetBitrateDeviation)),
      checkBitrate: (bitrate) => bitrate > this.minimumBitrate(this.defaultBitrate()) && bitrate < this.maximumBitrate(this.defaultBitrate()),
      reduceBitrate: (bitrate) => Math.floor(bitrate * (standards.resolution.wantedWidth() / standards.resolution.currentWidth)),
      currentBitrate: function () {
        if (file.bit_rate) {
          return Math.floor(file.bit_rate / 1000)
        } else if (file.meta.bit_rate) {
          return Math.floor(file.meta.bit_rate / 1000)
        } else {
          return Math.floor(file.file_size * 8 / file.meta.Duration * 1000)
        }
      },
      targetBitrate: function () {
        let targetBitrate = this.reduceBitrate(this.currentBitrate());
        if (this.checkBitrate(targetBitrate)) {
          return targetBitrate
        } else {
          return this.defaultBitrate()
        }
      },
      string: () => `-b:v ${this.targetBitrate()}k -minrate ${this.minimumBitrate(this.targetBitrate())}k -maxrate ${this.maximumBitrate(this.targetBitrate())}k -bufsize ${this.currentBitrate()}k`,
    },
    container: {
      met: file.container == inputs.container,
      reason: function () {
        if (this.met) {
          return `already ${inputs.container}`;
        } else {
          return `not ${inputs.container}`;
        }
      },
    },
  };

  if (standards.container.met !== true && standards.codec.met === true && standards.resolution.met === true) {
    response.preset = `, -map 0 -c copy ${extraArguments}`;
    response.infoLog += `☒File not ${inputs.container}, but matches otherwise, remuxing.\n`;
    response.processFile = true;
    return Response();
  }
  const checkStandards = function () {
    if (file.forceProcessing) {
      response.infoLog += `☒File is being forced processed.\n`;
      return true;
    }
    if (file.fileMedium !== 'video') {
      response.infoLog += '☒File is not a video. Skipping.\n';
      return false;
    }
    let reasons = [];
    let list = Object.keys(standards);
    for (let i = 0; i < list.length; i++) {
      reasons.push(standards[list[i]].reason());
      if (standards[list[i]].met === false && standards[list[i]].unless !== true) {
        response.infoLog += `☒File is ${standards[list[i]].reason()}. Transcoding file.\n`;
        return true;
      }
    }
    response.infoLog += `☑File is ${reasons.join(', and ')}. Skipping file.\n`;
    return false;
  }

  response.processFile = checkStandards();
  if (response.processFile === false && extraArguments === '') {
    return Response();
  }


  response.preset += `-hwaccel cuda -hwaccel_output_format cuda${genpts()}, -map 0 -vf scale_cuda=-2:${inputs.resolution} -c:v ${encoder} -preset ${inputs.preset} -crf 20 ${standards.bitrate.string()} ${getSubtitleCmd()} ${getAudioCmd()} -max_muxing_queue_size 99999 ${extraArguments}`;

  return Response();

  // Check if force_conform option is checked.
  // If so then check streams and add any extra parameters required to make file conform with output format.
  function conform() {
    let arguments = ''
    if (inputs.container == 'mkv') {
      arguments += ' -map -0:d';
      for (let i = 0; i < file.ffProbeData.streams.length; i++) {
        try {
          if (file.ffProbeData.streams[i].codec_name
            .toLowerCase() === 'mov_text'
            || file.ffProbeData.streams[i].codec_name
              .toLowerCase() === 'eia_608'
            || file.ffProbeData.streams[i].codec_name
              .toLowerCase() === 'timed_id3') {
            arguments += ` -map -0:${i}`;
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
    if (inputs.container == 'mp4') {
      for (let i = 0; i < file.ffProbeData.streams.length; i++) {
        try {
          if (file.ffProbeData.streams[i].codec_name
            .toLowerCase() === 'hdmv_pgs_subtitle'
            || file.ffProbeData.streams[i].codec_name
              .toLowerCase() === 'eia_608'
            || file.ffProbeData.streams[i].codec_name
              .toLowerCase() === 'subrip'
            || file.ffProbeData.streams[i].codec_name
              .toLowerCase() === 'timed_id3') {
            arguments += ` -map -0:${i}`;
          }
        } catch (err) {
          console.error(err);
        }
      }
    }

    return arguments;
  }


  function genpts() {
    if (file.meta.container == 'ts' || file.meta.container == 'avi') {
      return ' -fflags +genpts';
    }
    return '';
  }

  function removeImageStreams() {
    let arguments = '';
    let videoIdx = 0;
    for (let i = 0; i < file.ffProbeData.streams.length; i++) {
      if (file.ffProbeData.streams[i].codec_type.toLowerCase() === 'video') {
        if (file.ffProbeData.streams[i].codec_name.toLowerCase() === 'mjpeg' || file.ffProbeData.streams[i].codec_name.toLowerCase() === 'png') {
          arguments += ` -map -v:${videoIdx}`;
        }
        videoIdx += 1;
      }
    }
    return arguments;
  }

  function getSubtitleCmd() {
    let ffmpegCommandInsert = '';
    if (!inputs.subtitleLanguages || !inputs.subtitleTagLanguage) {
      response.infoLog += '☒ERROR: Subtitle language/s to keep have not been configured, please configure required options. \n';
      response.processFile = 'error';
      return;
    }
    const languages = inputs.subtitleLanguages.split(',');
    let subtitleIndex = -1;
    let streamIndex = -1
    streams.forEach((stream) => {
      streamIndex += 1;
      let codecType = stream.codec_type.toLowerCase();
      let codecName = stream.codec_name.toLowerCase();
      if (codecType.includes("sub") || codecName == "eia_608") { subtitleIndex++; } else { return; }
      let title = stream.tags.title.toLowerCase()
      let language = stream.tags.language.toLowerCase();
      if (!languages.includes(language)) {
        ffmpegCommandInsert += removeSubtitleStream(`having an unwanted language tag (${language})`);
        return;
      } else if (title.includes('commentary') || title.includes('description') || title.includes('sdh')) {
        ffmpegCommandInsert += removeSubtitleStream('being descriptive');
        return;
      }
      if (languages.includes(language) || !language){
        if ((codecName == "eia_608" || (codecName == "mov_text" && codecType.includes("sub")))) {
          ffmpegCommandInsert += `-c:${subtitleIndex} ass ${addMetadata()}`;
          response.infoLog += `☒Subtitle stream 0:s:${subtitleIndex} wrong type, converting. \n`;
        } else {
          ffmpegCommandInsert += `-c:${subtitleIndex} copy ${addMetadata()}`;
          response.infoLog += `☒Subtitle stream 0:s:${subtitleIndex} being copied. \n`;
        }
        return;
      }
      function removeSubtitleStream(reason) {
        response.infoLog += `☒Subtitle stream 0:s:${subtitleIndex} detected as ${reason}, removing. \n`;
        return `-map -0:s:${subtitleIndex} `;
      }
      function addMetadata() {
        if (language.includes('und') || !language) {
          response.infoLog += `☒Subtitle stream 0:s:${subtitleIndex} language is being tagged as ${inputs.subtitleTagLanguage}. \n`;
          return `-metadata:s:s:${subtitleIndex} language=${inputs.subtitleTagLanguage} `;
        } else {
          return '';
        }
      }
    });
    if (ffmpegCommandInsert !== '') {
      return ffmpegCommandInsert;
    } else {
      response.infoLog += "☑File doesn't contain subtitle tracks which are unwanted or that require tagging.\n";
      return '';
    }
  }

  function getAudioCmd() {
    if (inputs.audioLanguage === '') {
      response.infoLog += '☒Audio language/s options not set, please configure required options. Skipping Audio Cleanup.  \n';
      return '';
    }
    const languages = inputs.audioLanguages.split(',');
    let streams = file.ffProbeData.streams;
    const audioStreamCount = streams.filter((stream) => stream.codec_type.toLowerCase() === 'audio').length;
    let ffmpegCommandInsert = '';
    let audioStreamsRemoved = 0;
    let has = {
      twoChannel: false,
      sixChannel: false,
      eightChannel: false,
    }
    let streamIndex = -1
    let audioIndex = -1
    let audioStreams = [];
    streams.forEach((stream) => {
      streamIndex++;
      if (stream.codec_type.toLowerCase() !== 'audio') { return; }
      audioIndex++;
      audioStreams.push({
        'channelName': type,
        'channels': channelMap[type],
        'streamIndex': streamIndex,
        'audioIndex': audioIndex,
        'tags': stream.tags,
        'codec_name': stream.codec_name,
      });
      Object.keys(channelMap).forEach((type) => {
        if (stream.channels === channelMap[type]) {
          has[type] = true;
        }
      });
    });
    if (audioStreamCount !== audioStreams.length) { return ''; }
    audioStreams.sort((a, b) => {
      if (a.channels < b.channels) {
        return -1;
      }
      if (a.channels > b.channels) {
        return 1;
      }
      return 0;
    })
    let channelMap = {
      eightChannel: 8,
      sixChannel: 6,
      twoChannel: 2,
    }
    let needs = {
      twoChannel: !has.twoChannel,
      sixChannel: !has.sixChannel,
    }
    // Check all audio streams
    audioStreams.forEach((stream) => {
      let done = false
      ['commentary', 'description', 'sdh'].forEach((search) => {
        if (!done && title.includes(search)) {
          ffmpegCommandInsert += removeAudioStream('being descriptive');
        }
      });
      if (!done && !languages.includes(stream.tags.language)) {
        ffmpegCommandInsert += removeAudioStream(`having an unwanted language tag (${language})`);
      }
      Object.entries(needs).forEach((channel, isNeeded) => {
        if (!done && isNeeded) {
          ffmpegCommandInsert += addChannel(channel);
          needs[channel] = false;
        }
      });
      if (!done && stream.codec_name !== 'aac' && stream.channels === 2 && needs.twoChannel === true) {
        ffmpegCommandInsert += `-c:a:${stream.audioIndex} aac ${addTitleMetadata()} ${addLanguageTag()}`;
        response.infoLog += `☒Audio track ${stream.audioIndex}is 2 channel but is not AAC. Converting. \n`;
        done = true;
      }
      if (!done && (!stream.tags.title || !stream.tags.language) && inputs.audioTagLanguage !== '') {
        ffmpegCommandInsert += addTitleMetadata() + addLanguageTag();
        done = true;
      }
      function removeAudioStream(reason) {
        response.infoLog += `☒Audio stream 0:a:${stream.audioIndex} detected as ${reason}, removing. \n`;
        audioStreamsRemoved++;
        done = true;
        return `-map -0:a:${stream.audioIndex} `;
      }
      function addTitleMetadata(n) {
        let channels = n ? n : stream.channels
        response.infoLog += `☒Audio stream 0:a:${stream.audioIndex} is being tagged as ${channels} channel. \n`;
        return `-metadata:s:a:${stream.audioIndex} title="${channels === 2 ? 2.0 : (channels - 0.9)}" `;
      }
      function addChannel(n) {
        response.infoLog += `☒Using ${stream.channels} channel track to make ${channelMap[n]} channel track. \n`;
        return `-map 0:${stream.streamIndex} -c:a:${stream.audioIndex} ${(n > 2) ? 'ac3' : 'aac'} -ac ${n} ${addTitleMetadata()} ${addLanguageTag()} `;
      }
      function addLanguageTag() {
        if (inputs.audioTagLanguage !== '') {
          response.infoLog += `☒Audio stream 0:a:${stream.audioIndex} language is being tagged as ${inputs.audioTagLanguage}. \n`;
          done = true;
          return `language=${inputs.audioTagLanguage} `;
        } else {
          return '';
        }
      }
    });
    if (audioStreamsRemoved === audioStreamCount) {
      response.infoLog += '☒ERROR: all audio tracks would be removed. \n';
      response.processFile = 'error'
      return '';
    }
    return ffmpegCommandInsert;
  };
};

module.exports.details = details;
module.exports.plugin = plugin;

