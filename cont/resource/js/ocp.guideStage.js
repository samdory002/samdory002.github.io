;(function () {
  if (typeof window.CustomEvent === 'function') return false

  function CustomEvent(event, params) {
    params = params || { bubbles: false, cancelable: false, detail: undefined }
    var evt = document.createEvent('CustomEvent')
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail)
    return evt
  }

  CustomEvent.prototype = window.Event.prototype

  window.CustomEvent = CustomEvent
})()

var GUIDE_STAGE = (window.GUIDE_STAGE = window.GUIDE_STAGE || {})

/**
 * 이용가이드 스테이지 초기화
 * @param {*} props
 */
GUIDE_STAGE.init = function (props) {
  var self = this
  var _stage = new GUIDE_STAGE.Stage(props)
  var _controls = new GUIDE_STAGE.Controls(props)

  setEvent()

  function setEvent() {
    /**
     * 터치 포인트 클릭시 다음 단계로 이동
     */
    document.addEventListener('processNext', function () {
      // 자동재생 중이 아니라면, finish 상태가 아니라면 다음 단계로 이동
      if (!_controls.getAutoPlay() && !_controls.getFinish()) {
        if (_controls.getCurrent() < _controls.getTotal() - 1) {
          _controls.next()
        } else {
          _controls.finish()
        }
      }
    })

    /**
     * 단계 변경 이벤트 : 부모창의 툴팁 업데이트
     */
    document.addEventListener('processChange', function (event) {
      var current = event.detail.current
      var description = props.data.process[current - 1].description

      if (description && description !== '') {
        try {
          parent.App.workflowBridge.notify({
            type: 'tooltip',
            data: description
          })
        } catch (e) {}
      }
    })

    var event = new CustomEvent('processChange', {
      detail: {
        current: 1,
        total: props.data.process.length,
        index: props.data.process[0].index
      }
    })
    document.dispatchEvent(event)
    /*
    var description = props.data.process[0].description;
    if (description && description !== '') {
      try{
        parent.App.workflowBridge.notify({ type: 'tooltip', data: description });
      } catch (e) {
        console.log('tooltip 업데이트 오류', e.message)
      }
    }
      */
  }
}

/**
 * 스테이지 객체
 * @param {*} props
 */
GUIDE_STAGE.Stage = function (props) {
  var self = this
  var _data = props.data
  var _touchPoint = null
  var _stageContent = null

  function init() {
    _touchPoint = document.getElementById('touchPoint')
    _stageContent = document.getElementById('stageContent')
    setEvent()

    setTimeout(function () {
      setTouchPoint(1)
      setStageContent(1)
    }, 500)
  }

  function setEvent() {
    // 단계 변경 이벤트
    document.addEventListener('processChange', function (event) {
      // detail 값 참조 방법
      var current = event.detail.current
      var total = event.detail.total

      setTouchPoint(current)
      setStageContent(current)
    })

    // 터치 포인트 클릭 이벤트
    _touchPoint.addEventListener('click', function () {
      onClickTouchPoint()
    })
  }

  function onClickTouchPoint() {
    var event = new CustomEvent('processNext')
    document.dispatchEvent(event)
  }

  function setTouchPoint(current) {
    _touchPoint.classList.remove('on')
    var _pointer = _data.process[current - 1].pointer

    if (_pointer) {
      _touchPoint.style.left = _pointer.left + 'px'
      _touchPoint.style.top = _pointer.top + 'px'

      setTimeout(function () {
        _touchPoint.classList.add('on')
      }, 700)
    }
  }

  function setStageContent(current) {
    var _scrollTop = _data.process[current - 1].scrollTop
    var _type = _data.process[current - 1].type

    if (_type === 'scroll' || _type === 'default') {
        setTimeout(function () {
        _stageContent.style.top = _scrollTop * -1 + 'px'
      }, 50)
    } else if (_type === 'changeToScroll') {
      setTimeout(function () {
        _stageContent.style.top = _scrollTop * -1 + 'px'
      }, 500)
    }
  }

  init()
}

/**
 * 자동재생 컨트롤 객체
 * @param {*} props
 */
GUIDE_STAGE.Controls = function (props) {
  var self = this
  // DOM Elements
  var _playBtn = null
  var _pauseBtn = null
  var _progressBar = null
  var _progressBarFill = null

  // Variables
  var _isPlaying = false
  var _total = 0
  var _current = 0
  var _interval = null
  var _is_finish = false

  var _intervalTime = 3000
  var _intervalCnt = 0

  function init() {
    _total = props.data.process.length
    _current = 1
    setElements()
    setButtons()
    setDivideProgress()

    setTimeout(function () {
      parent.App.workflowBridge.getAutoPlayState() ? self.play() : self.pause()
    }, 1000)
  }

  function setElements() {
    _playBtn = document.getElementById('btn-play')
    _pauseBtn = document.getElementById('btn-pause')
    _progressBar = document.querySelector('.progress-bar')
    _progressBarFill = document.querySelector('.progress-bar-fill')
  }

  function setButtons() {
    _playBtn.addEventListener('click', function () {
      self.play()
      parent.App.workflowBridge.notify({ type: 'autoplay', data: true })
    })

    _pauseBtn.addEventListener('click', function () {
      self.pause()
      parent.App.workflowBridge.notify({ type: 'autoplay', data: false })
    })
  }

  function setDivideProgress() {
    var _intervalWidth = 100 / (_total - 1)
    var _cnt = _total
    var _dividerEl = document.createElement('div')
    _dividerEl.classList.add('progress-divider')
    _progressBar.appendChild(_dividerEl)

    for (var i = 0; i < _cnt; i++) {
      var _itemEl = document.createElement('span')
      _itemEl.classList.add('progress-divider-item')
      _itemEl.style.left = i * _intervalWidth + '%'
      _dividerEl.appendChild(_itemEl)
    }
  }

  function startInterval() {
    _interval = setInterval(function () {
      if (_intervalCnt === 10) {
        _intervalCnt = 0
        if (_total - 1 > _current) {
          self.next()
        } else {
          self.finish()
        }
      } else {
        _intervalCnt++
        var _intervalWidth = 100 / (_total - 1) / 10
        _progressBarFill.style.width =
          ((_current - 1) / (_total - 1)) * 100 +
          _intervalCnt * _intervalWidth +
          '%'
      }
    }, _intervalTime / 10)
  }

  this.getAutoPlay = function () {
    return _isPlaying
  }

  this.getFinish = function () {
    return _is_finish
  }

  this.getCurrent = function () {
    return _current
  }

  this.getTotal = function () {
    return _total
  }

  this.finish = function () {
    _current++
    _is_finish = true
    _progressBarFill.style.width = '100%'
    this.stop()
    var __index = props.data.process[_current - 1].index
    var event = new CustomEvent('processChange', {
      detail: { current: _current, total: _total, index: __index }
    })
    document.dispatchEvent(event)

    if (_isPlaying) {
      parent.App.workflowBridge.notify({ type: 'finish' })
    } else {
      setTimeout(function () {
        parent.App.workflowBridge.notify({ type: 'finish' })
      }, 600)
    }
  }

  this.next = function () {
    _current++
    _progressBarFill.style.width = ((_current - 1) / (_total - 1)) * 100 + '%'
    var __index = props.data.process[_current - 1].index
    var event = new CustomEvent('processChange', {
      detail: { current: _current, total: _total, index: __index }
    })
    _intervalCnt = 0
    document.dispatchEvent(event)
  }

  this.play = function () {
    if (_is_finish) {
      return
    }
    _isPlaying = true
    _playBtn.classList.remove('on')
    _playBtn.classList.add('off')

    _pauseBtn.classList.remove('off')
    _pauseBtn.classList.add('on')

    startInterval()
  }

  this.pause = function () {
    _isPlaying = false
    _playBtn.classList.remove('off')
    _playBtn.classList.add('on')

    _pauseBtn.classList.remove('on')
    _pauseBtn.classList.add('off')

    clearInterval(_interval)
  }

  this.stop = function () {
    _isPlaying = false
    _playBtn.classList.remove('off')
    _playBtn.classList.add('on')

    _pauseBtn.classList.remove('on')
    _pauseBtn.classList.add('off')

    if (_interval) {
      clearInterval(_interval)
    }
  }

  init()
}
