/**
 * Jest stub for react-native-sound. The native module is not linked in the
 * test environment, so app-level tests exercise the JS path only.
 */
class Sound {
  static MAIN_BUNDLE = 1;

  static setCategory(_category, _mixing) {}

  constructor(_url, _bundle, callback) {
    if (typeof _bundle === 'function') {
      _bundle(null);
    } else if (typeof callback === 'function') {
      callback(null);
    }
  }

  play(callback) {
    if (typeof callback === 'function') {
      callback(true);
    }
    return this;
  }

  stop(callback) {
    if (typeof callback === 'function') {
      callback();
    }
    return this;
  }

  pause(callback) {
    if (typeof callback === 'function') {
      callback();
    }
    return this;
  }

  release() {}

  setVolume(_value) {}

  getDuration() {
    return 0;
  }
}

module.exports = Sound;