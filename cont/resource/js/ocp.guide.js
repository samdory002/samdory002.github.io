// Store: 전역 페이지 상태
var Store = {
  state: {
    currentPage: 'intro' // 현재 페이지
  },

  listeners: [],

  // 현재 페이지를 변경하고 모든 구독 상태요소에 전달
  setPage: function (page) {
    if (this.state.currentPage === page) return
    this.state.currentPage = page
    this.notify()
  },

  // 상태 변경을 받고 싶은 콜백 등록
  subscribe: function (fn) {
    this.listeners.push(fn)
  },

  // 등록된 콜백들을 순회하며 현재 상태 전달
  notify: function () {
    for (var i = 0; i < this.listeners.length; i++) {
      this.listeners[i](this.state)
    }
  }
}

// Router: 해시 기반 SPA 라우터 (신규 이용자 가이드 - onboarding, 업무별 체험 - workflow, 전체메뉴 - menu)
var Router = {
  routes: {
    intro: '/cont/tutorial/components/intro.html',
    menu: '/cont/tutorial/components/menu.html',
    onboarding: '/cont/tutorial/components/onboarding.html',
    workflow: '/cont/tutorial/components/workflow.html'
  },

  // 페이지별 메타데이터: 제목, 뱃지, 헤더 버튼 노출 여부 등을 정의한다.
  pageMeta: {
    intro: {
      title: '기업뱅킹 이용가이드 - 소개',
      badge: null,
      showHome: false,
      showMenu: false
    },
    menu: {
      title: '기업뱅킹 이용가이드 - 전체 메뉴',
      badge: { text: '업무별 체험', className: 'guide' },
      showHome: true,
      showMenu: false
    },
    onboarding: {
      title: '기업뱅킹 이용가이드 - 신규 이용자',
      badge: { text: '신규 이용자', className: 'new' },
      showHome: true,
      showMenu: false
    },
    workflow: {
      title: '기업뱅킹 이용가이드 - 업무별 체험',
      badge: { text: '업무별 체험', className: 'guide' },
      showHome: true,
      showMenu: true
    }
  },

  // 외부(App)에서 전달받을 콜백 모음
  callbacks: null,

  // 해시 변경을 감지하고 초기 페이지를 로드한다.
  init: function (callbacks) {
    var self = this
    this.callbacks = callbacks || {}
    window.addEventListener('hashchange', function () {
      var page = location.hash.replace('#', '') || 'intro'
      page = page.split('?')[0]
      if (App && typeof App.applyInitialWorkflowTarget === 'function') {
        App.applyInitialWorkflowTarget()
      }
      self.load(page)
    })
    var defaultPage = location.hash.replace('#', '') || 'intro'
    defaultPage = defaultPage.split('?')[0]
    this.load(defaultPage)
  },

  // 지정된 라우트의 HTML 파셜을 불러온 뒤 App으로 렌더링 결과를 알려준다.
  load: function (page) {
    var self = this
    var file = this.routes[page] || this.routes.intro
    var meta = this.pageMeta[page] || {}
    this.request(file, function (err, html) {
      if (err) {
        return
      }
      var appContent = document.querySelector('#appContent')
      if (!appContent) return
      appContent.innerHTML = html
      document.title = meta.title || '기업뱅킹 이용가이드'
      if (self.callbacks && typeof self.callbacks.onRendered === 'function') {
        self.callbacks.onRendered(page, meta)
      }
    })
  },

  // HTML을 가져오기 위한 공용 XHR 헬퍼
  request: function (file, callback) {
    var xhr = new XMLHttpRequest()
    xhr.open('GET', file, true)
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return
      if (xhr.status >= 200 && xhr.status < 300) {
        callback(null, xhr.responseText)
      } else {
        callback(new Error('Failed to load: ' + file))
      }
    }
    xhr.send()
  }
}

var App = (window.App = window.App || {})

// App 전역 상태: 각 화면 제어기와 비동기 요청 식별자를 공유한다.
App.state = {
  onboardingController: null, // 신규 이용자(onboarding) 영역 제어기
  menuController: null, // 전체 메뉴 페이지 컨트롤러
  workflowController: null, // 업무별 체험(Workflow) 컨트롤러
  workflowRequestId: 0, // workflow 데이터 요청 식별자
  workflowMenuId: null, // 선택된 업무별 체험 메뉴 ID
  workflowAutoPlay: false, // 업무별 체험 자동재생 상태
  workflowPages: [], // 메뉴.json 전체 목록 (다음 메뉴 이동용)
  workflowReady: false // start 팝업의 시작하기 전까지 iframe 로드 지연
}

App.workflowBridge = null

// 화면별 모듈(신규 이용자 가이드, 업무별 메뉴 등)을 한곳에 모아 관리한다.
// App.modules: 개별 화면/컴포넌트를 위한 컨트롤러 모음
App.modules = {
  // dialog: /components/dialogs/{id}.html 파셜을 불러와 표시하는 공통 팝업 제어기
  dialog: {
    basePath: '/cont/tutorial/components/dialogs/',
    wrapper: null,
    currentId: null,
    triggerHandler: null,
    closeTimer: null,

    // bindTriggers: 문서 전체에서 팝업 트리거/내비게이션/닫기 버튼을 감지한다.
    bindTriggers: function () {
      var self = this
      if (this.triggerHandler) return
      this.triggerHandler = function (event) {
        var target = event.target
        while (target && target !== document) {
          if (target.hasAttribute('data-dialog-id')) {
            var id = target.getAttribute('data-dialog-id')
            if (id) {
              event.preventDefault()
              self.open(id)
            }
            return
          }
          if (target.hasAttribute('data-navigate')) {
            event.preventDefault()
            App.navigateByTarget(target)
            self.close()
            return
          }
          if (target.hasAttribute('data-dialog-close')) {
            event.preventDefault()
            self.close()
            return
          }
          target = target.parentNode
        }
      }
      document.addEventListener('click', this.triggerHandler)
    },

    // getPath: dialog id로 파셜 파일 경로 생성
    getPath: function (id) {
      return this.basePath + id + '.html'
    },

    // open: 파셜을 로드해 wrapper에 삽입하고 payload 바인딩
    open: function (id, payload) {
      if (!id) return
      if (!this.ensureContainer()) return
      if (this.closeTimer) {
        clearTimeout(this.closeTimer)
        this.closeTimer = null
      }
      var path = this.getPath(id)
      var self = this
      App.requestHtml(path, function (err, html) {
        if (err) {
          return
        }
        self.wrapper.innerHTML = html
        self.applyDialogData(payload)
        self.wrapper.classList.remove('is-hidden')
        self.wrapper.style.transition = 'opacity 500ms ease'
        self.wrapper.style.opacity = '0'
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(function () {
            self.wrapper.style.opacity = '1'
          })
        } else {
          self.wrapper.style.opacity = '1'
        }
        self.currentId = id
      })
    },

    close: function () {
      if (!this.wrapper) return
      var self = this
      var closingId = this.currentId
      if (this.closeTimer) {
        clearTimeout(this.closeTimer)
        this.closeTimer = null
      }
      this.wrapper.style.transition = 'opacity 500ms ease'
      this.wrapper.style.opacity = '0'
      this.closeTimer = setTimeout(function () {
        self.closeTimer = null
        if (self.currentId !== closingId) {
          return
        }
        self.wrapper.classList.add('is-hidden')
        self.wrapper.innerHTML = ''
        self.currentId = null
        self.wrapper.style.opacity = ''
      }, 500)
    },

    init: function () {
      this.ensureContainer()
      this.bindTriggers()
    },

    ensureContainer: function () {
      if (this.wrapper) return true
      var body = document.body
      if (!body) return false
      var wrapper = document.createElement('div')
      wrapper.className = 'dialog-wrapper is-hidden'
      wrapper.setAttribute('data-dialog-wrapper', '')
      var firstScript = body.querySelector('script')
      if (firstScript) {
        body.insertBefore(wrapper, firstScript)
      } else {
        body.appendChild(wrapper)
      }
      this.wrapper = wrapper
      return true
    },

    // renderMultilineText: \n 줄바꿈이 있는 텍스트를 <br>로 변환해 렌더링
    renderMultilineText: function (target, text) {
      if (!target) return
      while (target.firstChild) {
        target.removeChild(target.firstChild)
      }
      var value = text || ''
      var lines = value.split(/\r?\n/)
      for (var i = 0; i < lines.length; i++) {
        if (i > 0) {
          target.appendChild(document.createElement('br'))
        }
        target.appendChild(document.createTextNode(lines[i]))
      }
    },

    // applyDialogData: dialog 내부 data-* 대상에 payload 정보를 바인딩
    applyDialogData: function (payload) {
      if (!this.wrapper) return
      payload = payload || {}
      var title = payload.title || ''
      var info = payload.info || ''
      var infoList = payload.infoList || null
      var workflowId = payload.workflowId || payload.pageId || ''
      var stepIndex = ''
      var finishType = payload.finishType || ''
      var finishBreak = false
      if (
        App.state &&
        App.state.workflowController &&
        App.state.workflowController.data
      ) {
        if (!title) {
          title = App.state.workflowController.data.title || ''
        }
        stepIndex = App.state.workflowController.getStepIndex
          ? App.state.workflowController.getStepIndex()
          : ''
        if (
          typeof App.state.workflowController.data.finishBreak !== 'undefined'
        ) {
          finishBreak = !!App.state.workflowController.data.finishBreak
        }
      }
      if (typeof payload.finishBreak !== 'undefined') {
        finishBreak = !!payload.finishBreak
      }
      if (
        !title &&
        stepIndex === '' &&
        !info &&
        !(infoList && infoList.length) &&
        !workflowId
      ) {
        return
      }
      // data-dialog-menu: 메뉴명/타이틀 바인딩(줄바꿈 없이 한 줄로 처리)
      var targets = this.wrapper.querySelectorAll('[data-dialog-menu]')
      for (var i = 0; i < targets.length; i++) {
        var textValue = title
        if (targets[i].textContent.indexOf('$n$') > -1 && stepIndex !== '') {
          textValue = targets[i].textContent.replace('$n$', String(stepIndex))
        }
        targets[i].textContent = textValue
      }
      // finishBreak: 종료 팝업 문구에서 메뉴명 뒤에 강제 줄바꿈을 삽입할지 여부
      if (finishBreak && finishType === 'menu') {
        var finishMenus = this.wrapper.querySelectorAll(
          'p[data-dialog-type="menu"] [data-dialog-menu]'
        )
        for (var bm = 0; bm < finishMenus.length; bm++) {
          var menuSpan = finishMenus[bm]
          if (menuSpan.nextSibling && menuSpan.nextSibling.nodeName === 'BR') {
            continue
          }
          menuSpan.parentNode.insertBefore(
            document.createElement('br'),
            menuSpan.nextSibling
          )
        }
      }
      // data-dialog-step: 현재 스텝 번호 바인딩
      var steps = this.wrapper.querySelectorAll('[data-dialog-step]')
      for (var j = 0; j < steps.length; j++) {
        steps[j].textContent = stepIndex ? String(stepIndex) : ''
      }
      // data-dialog-info: 본문 텍스트(줄바꿈 허용)
      var infoNodes = this.wrapper.querySelectorAll('[data-dialog-info]')
      for (var m = 0; m < infoNodes.length; m++) {
        if (info) {
          infoNodes[m].style.display = ''
          this.renderMultilineText(infoNodes[m], info)
        } else {
          infoNodes[m].style.display = 'none'
          infoNodes[m].textContent = ''
        }
      }
      // data-dialog-list: 안내 목록(리스트형)
      var listNodes = this.wrapper.querySelectorAll('[data-dialog-list]')
      for (var n = 0; n < listNodes.length; n++) {
        if (infoList && infoList.length) {
          listNodes[n].style.display = ''
          while (listNodes[n].firstChild) {
            listNodes[n].removeChild(listNodes[n].firstChild)
          }
          for (var x = 0; x < infoList.length; x++) {
            var item = document.createElement('li')
            this.renderMultilineText(item, infoList[x])
            listNodes[n].appendChild(item)
          }
        } else {
          listNodes[n].style.display = 'none'
          while (listNodes[n].firstChild) {
            listNodes[n].removeChild(listNodes[n].firstChild)
          }
        }
      }
      // data-dialog-start: 시작하기 버튼 -> workflow 시작 트리거 연결
      var startButtons = this.wrapper.querySelectorAll('[data-dialog-start]')
      for (var s = 0; s < startButtons.length; s++) {
        if (workflowId) {
          startButtons[s].setAttribute(
            'data-navigate',
            'workflow-start:' + workflowId
          )
        } else {
          startButtons[s].removeAttribute('data-navigate')
        }
      }
      // data-dialog-type: finish 팝업 내 step/menu 분기
      if (finishType) {
        var nodes = this.wrapper.querySelectorAll('[data-dialog-type]')
        for (var k = 0; k < nodes.length; k++) {
          if (nodes[k].getAttribute('data-dialog-type') === finishType) {
            nodes[k].style.display = ''
          } else {
            nodes[k].style.display = 'none'
          }
        }
      }
    }
  },
  onboarding: {
    // 신규 이용자 가이드(onboarding) 영역 컨트롤러 생성
    create: function (root) {
      var steps = [].slice.call(root.querySelectorAll('[data-onboarding-step]'))
      if (!steps.length) return null

      var controller = {
        root: root,
        steps: steps,
        navWrap: root.querySelector('[data-onboarding-nav]') || null,
        dotsWrap: root.querySelector('[data-onboarding-dots]') || null,
        prevButton: root.querySelector('[data-onboarding-prev]') || null,
        nextButtons: [].slice.call(
          root.querySelectorAll('[data-onboarding-next]')
        ),
        dotButtons: [],
        observer: null,
        wheelHandler: null,
        keyHandler: null,
        scrollHandler: null,
        scrollTimer: null,
        index: -1,
        wheelLocked: false,
        scrollLockTimer: null,
        heroMenuLinks: [].slice.call(
          root.querySelectorAll(
            '.onboarding-step.hero [data-onboarding-target]'
          )
        ),
        heroMenuHandlers: [],
        tabControllers: []
      }

      // 특정 스텝으로 스크롤 이동
      controller.scrollToStep = function (target) {
        if (!target) return
        var top =
          target.getBoundingClientRect().top -
          this.root.getBoundingClientRect().top +
          this.root.scrollTop
        if (typeof this.root.scrollTo === 'function') {
          this.root.scrollTo({ top: top, behavior: 'smooth' })
        } else {
          this.root.scrollTop = top
        }
      }

      // 연속 입력을 방지하기 위한 잠금 처리
      controller.lockScroll = function (duration) {
        var self = this
        this.wheelLocked = true
        if (this.scrollLockTimer) {
          clearTimeout(this.scrollLockTimer)
        }
        this.scrollLockTimer = setTimeout(function () {
          self.wheelLocked = false
          self.scrollLockTimer = null
        }, duration || 800)
      }

      // 도트 내비게이션 구성
      controller.buildDots = function () {
        if (!this.dotsWrap) return
        this.dotsWrap.innerHTML = ''
        this.dotButtons = []
        for (var i = 1; i < this.steps.length; i++) {
          var button = document.createElement('button')
          button.setAttribute('type', 'button')
          button.setAttribute('data-onboarding-dot', i)
          button.setAttribute('data-onboarding-step-number', i)
          button.className = 'onboarding-dot'
          button.innerHTML = '<span></span>'
          this.dotsWrap.appendChild(button)
          this.dotButtons.push(button)
        }
      }

      // 클릭/휠/키보드 등 사용자 입력을 바인딩
      controller.bindEvents = function () {
        var self = this
        if (this.prevButton) {
          this.prevButton.addEventListener('click', function (event) {
            event.preventDefault()
            if (self.wheelLocked) return
            self.goTo(self.index - 1)
          })
        }
        for (var i = 0; i < this.nextButtons.length; i++) {
          this.nextButtons[i].addEventListener('click', function (event) {
            event.preventDefault()
            if (self.wheelLocked) return
            self.goTo(self.index + 1)
          })
        }
        if (this.dotsWrap) {
          this.dotsWrap.addEventListener('click', function (event) {
            var target = event.target
            while (target && target !== self.dotsWrap) {
              var indexAttr = target.getAttribute('data-onboarding-dot')
              if (indexAttr !== null) {
                if (self.wheelLocked) return
                self.goTo(parseInt(indexAttr, 10))
                return
              }
              target = target.parentNode
            }
          })
        }
        this.root.addEventListener('click', function (event) {
          var target = event.target
          while (target && target !== self.root) {
            if (target.getAttribute('data-onboarding-action') === 'join') {
              event.preventDefault()
              if (window.opener) {
                window.opener.location.href =
                  '/cont/product/product05/product051/1478597_144510.jsp'
              } else {
                window.open(
                  location.protocol +
                    '//' +
                    location.host +
                    '/rebuild.jsp?goUrl=/cont/product/product05/product051/1478597_144510.jsp',
                  '_blank'
                )
              }
              return
            }
            target = target.parentNode
          }
        })

        this.wheelHandler = function (event) {
          if (event && event.preventDefault) {
            event.preventDefault()
          }
          if (self.wheelLocked) return
          var delta = event.deltaY || event.detail
          if (!delta) return
          if (Math.abs(delta) < 10) return
          if (delta > 0) {
            self.goTo(self.index + 1)
          } else {
            self.goTo(self.index - 1)
          }
        }
        this.root.addEventListener('wheel', this.wheelHandler)

        this.keyHandler = function (event) {
          if (event.keyCode === 38 || event.keyCode === 40) {
            if (self.wheelLocked) {
              event.preventDefault()
              return
            }
          }
          if (event.keyCode === 38) {
            self.goTo(self.index - 1)
            event.preventDefault()
          } else if (event.keyCode === 40) {
            self.goTo(self.index + 1)
            event.preventDefault()
          }
        }
        window.addEventListener('keydown', this.keyHandler)

        if ('IntersectionObserver' in window) {
          this.observer = new IntersectionObserver(
            function (entries) {
              if (self.wheelLocked) return
              for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                  var observedIndex = self.steps.indexOf(entries[i].target)
                  if (observedIndex > -1 && self.index !== observedIndex) {
                    self.setActive(observedIndex, true)
                  }
                }
              }
            },
            { threshold: 0.6, root: self.root }
          )
          for (var j = 0; j < this.steps.length; j++) {
            this.observer.observe(this.steps[j])
          }
        } else {
          this.scrollHandler = function () {}
        }
      }

      // 버튼/도트 상태 업데이트 + 첫 화면 여부 반영
      controller.updateNavState = function () {
        if (this.prevButton) {
          this.prevButton.disabled = this.index === 0
        }
        for (var nb = 0; nb < this.nextButtons.length; nb++) {
          this.nextButtons[nb].disabled = this.index >= this.steps.length - 1
        }
        for (var i = 0; i < this.dotButtons.length; i++) {
          var dotIndex = parseInt(
            this.dotButtons[i].getAttribute('data-onboarding-dot'),
            10
          )
          var label = this.dotButtons[i].getAttribute(
            'data-onboarding-step-number'
          )
          this.dotButtons[i].textContent = ''
          this.dotButtons[i].classList.remove('is-active')
          if (dotIndex === this.index) {
            this.dotButtons[i].classList.add('is-active')
            this.dotButtons[i].textContent = label || dotIndex + 1
          }
        }
        this.root.classList.toggle('is-first-step', this.index === 0)
        if (this.navWrap) {
          this.navWrap.hidden = this.index === 0
        }
      }

      // 활성 스텝 설정 및 스크롤 이동
      controller.setActive = function (index, silent) {
        if (index < 0 || index >= this.steps.length) return false
        if (this.index === index) return false
        this.index = index
        // 온보딩 재진입/새로고침 복원을 위해 현재 스텝을 세션에 저장
        try {
          window.sessionStorage.setItem('onboardingStep', String(this.index))
        } catch (error) {}
        for (var i = 0; i < this.steps.length; i++) {
          if (i === index) {
            this.steps[i].classList.add('is-active')
          } else {
            this.steps[i].classList.remove('is-active')
          }
        }
        this.updateNavState()
        if (!silent) {
          var target = this.steps[index]
          this.scrollToStep(target)
        }
        return true
      }

      // 히스토리에 현재 스텝 정보를 저장
      controller.pushHistory = function (index) {
        if (!window.history || !window.history.pushState) return
        try {
          history.pushState(
            { onboardingStep: index },
            document.title,
            document.location.href
          )
        } catch (e) {}
      }

      controller.replaceHistory = function (index) {
        if (!window.history || !window.history.replaceState) return
        try {
          history.replaceState(
            { onboardingStep: index },
            document.title,
            document.location.href
          )
        } catch (e) {}
      }

      // goTo: 스텝 이동의 단일 진입점
      controller.goTo = function (index, options) {
        var clamped = Math.max(0, Math.min(this.steps.length - 1, index))
        var changed = this.setActive(clamped, options && options.silent)
        if (changed && !(options && options.skipHistory)) {
          this.pushHistory(this.index)
        }
        if (changed) {
          var duration = options && options.lockDuration
          var skipLock = options && options.skipLock
          if (!skipLock || duration) {
            this.lockScroll(duration)
          }
        }
      }

      controller.buildDots()

      // 히어로(최상단) 메뉴 버튼 -> 해당 스텝 이동
      controller.bindHeroMenu = function () {
        if (!this.heroMenuLinks.length) return
        var self = this
        this.heroMenuHandlers = []
        for (var i = 0; i < this.heroMenuLinks.length; i++) {
          ;(function (link, position) {
            var handler = function (event) {
              if (event) event.preventDefault()
              if (self.wheelLocked) return
              var attr = link.getAttribute('data-onboarding-target')
              var targetIndex = parseInt(attr, 10)
              if (isNaN(targetIndex)) {
                targetIndex = position + 1
              }
              self.goTo(targetIndex, { lockDuration: 800 })
            }
            link.addEventListener('click', handler)
            self.heroMenuHandlers.push({ link: link, handler: handler })
          })(this.heroMenuLinks[i], i)
        }
      }

      controller.unbindHeroMenu = function () {
        if (!this.heroMenuHandlers || !this.heroMenuHandlers.length) return
        for (var i = 0; i < this.heroMenuHandlers.length; i++) {
          var item = this.heroMenuHandlers[i]
          if (item.link && item.handler) {
            item.link.removeEventListener('click', item.handler)
          }
        }
        this.heroMenuHandlers = []
      }

      // 탭 UI 바인딩 (data-tab-* 속성을 사용)
      controller.bindTabs = function () {
        var tabLists = [].slice.call(
          this.root.querySelectorAll('[data-tab-list]')
        )
        if (!tabLists.length) return
        var self = this
        this.tabControllers = []
        for (var i = 0; i < tabLists.length; i++) {
          ;(function (list) {
            var buttons = [].slice.call(list.querySelectorAll('[data-tab]'))
            if (!buttons.length) return
            var tabContainer = list.parentNode || self.root
            var panels = [].slice.call(
              tabContainer.querySelectorAll('[data-tab-panel]')
            )
            var tabGroupId =
              list.getAttribute('data-tab-group') || String(i + 1)
            var tabStorageKey = 'onboardingTab:' + tabGroupId
            var setActive = function (name) {
              for (var b = 0; b < buttons.length; b++) {
                if (buttons[b].getAttribute('data-tab') === name) {
                  buttons[b].classList.add('is-active')
                } else {
                  buttons[b].classList.remove('is-active')
                }
              }
              for (var p = 0; p < panels.length; p++) {
                var panel = panels[p]
                if (!panel) continue
                if (panel.getAttribute('data-tab-panel') === name) {
                  panel.style.opacity = '0'
                  panel.style.transition = 'opacity 500ms ease'
                  panel.style.display = ''
                  panel.classList.add('is-active')
                  ;(function (target) {
                    setTimeout(function () {
                      target.style.opacity = '1'
                    }, 20)
                  })(panel)
                } else {
                  panel.style.opacity = '0'
                  panel.style.transition = 'opacity 500ms ease'
                  panel.classList.remove('is-active')
                  ;(function (target) {
                    setTimeout(function () {
                      if (!target.classList.contains('is-active')) {
                        target.style.display = 'none'
                      }
                    }, 500)
                  })(panel)
                }
              }
              try {
                window.sessionStorage.setItem(tabStorageKey, name)
              } catch (error) {}
            }
            var initial = null
            try {
              var savedTab = window.sessionStorage.getItem(tabStorageKey)
              if (savedTab) {
                initial = savedTab
              }
            } catch (error) {}
            if (!initial) {
              for (var j = 0; j < buttons.length; j++) {
                if (buttons[j].classList.contains('is-active')) {
                  initial = buttons[j].getAttribute('data-tab')
                  break
                }
              }
            }
            if (!initial) {
              initial = buttons[0].getAttribute('data-tab')
              buttons[0].classList.add('is-active')
            }
            setActive(initial)
            var clickHandler = function (event) {
              var target = event.target
              while (target && target !== list) {
                var tabName = target.getAttribute('data-tab')
                if (tabName) {
                  event.preventDefault()
                  setActive(tabName)
                  return
                }
                target = target.parentNode
              }
            }
            list.addEventListener('click', clickHandler)
            self.tabControllers.push({ list: list, handler: clickHandler })
          })(tabLists[i])
        }
      }

      controller.unbindTabs = function () {
        if (!this.tabControllers || !this.tabControllers.length) return
        for (var i = 0; i < this.tabControllers.length; i++) {
          var group = this.tabControllers[i]
          if (group.list && group.handler) {
            group.list.removeEventListener('click', group.handler)
          }
        }
        this.tabControllers = []
      }

      controller.bindHeroMenu()
      controller.bindTabs()
      controller.bindEvents()

      // 새로고침 시에는 저장된 스텝을 우선 사용, 일반 진입 시에는 hero(0)
      var initialIndex = 0
      try {
        var savedStep = window.sessionStorage.getItem('onboardingStep')
        var parsedStep = savedStep !== null ? parseInt(savedStep, 10) : null
        if (parsedStep !== null && !isNaN(parsedStep)) {
          initialIndex = parsedStep
        } else if (
          window.history &&
          history.state &&
          typeof history.state.onboardingStep === 'number'
        ) {
          initialIndex = history.state.onboardingStep
        }
      } catch (error) {
        if (
          window.history &&
          history.state &&
          typeof history.state.onboardingStep === 'number'
        ) {
          initialIndex = history.state.onboardingStep
        }
      }
      // 첫 화면(hero) 이외에는 스크롤 이동까지 수행
      controller.setActive(initialIndex, initialIndex === 0)
      controller.root.classList.add('is-ready')
      controller.replaceHistory(initialIndex)

      controller.destroy = function () {
        if (this.observer) {
          this.observer.disconnect()
        }
        if (this.scrollHandler) {
          this.root.removeEventListener('scroll', this.scrollHandler)
        }
        if (this.keyHandler) {
          window.removeEventListener('keydown', this.keyHandler)
        }
        if (this.wheelHandler) {
          this.root.removeEventListener('wheel', this.wheelHandler)
        }
        if (this.scrollLockTimer) {
          clearTimeout(this.scrollLockTimer)
          this.scrollLockTimer = null
        }
        this.unbindHeroMenu()
        this.unbindTabs()
      }

      return controller
    }
  },

  menu: {
    create: function (root) {
      if (App.ensureWorkflowPages) {
        App.ensureWorkflowPages()
      }
      var nav = root.querySelector('[data-menu-nav]')
      var buttons = nav
        ? [].slice.call(nav.querySelectorAll('[data-menu-target]'))
        : []
      var sections = [].slice.call(root.querySelectorAll('[data-menu-section]'))
      var scrollBox = root.querySelector('.menu-contents') || root
      if (!sections.length) return null

      var controller = {
        root: root,
        scrollBox: scrollBox,
        nav: nav,
        buttons: buttons,
        sections: sections,
        sectionMap: {},
        activeId: null,
        scrollHandler: null,
        scrollTimeout: null,
        lockedByScroll: false,
        lockTimer: null
      }

      for (var i = 0; i < sections.length; i++) {
        var id = sections[i].getAttribute('data-menu-section')
        if (id) {
          controller.sectionMap[id] = sections[i]
        }
      }

      controller.getOffset = function () {
        return 0
      }

      controller.scrollToId = function (id) {
        var target = this.sectionMap[id]
        if (!target) return
        var containerRect = this.scrollBox.getBoundingClientRect()
        var sectionRect = target.getBoundingClientRect()
        var delta = sectionRect.top - containerRect.top
        var nextTop = this.scrollBox.scrollTop + delta
        if (nextTop < 0) nextTop = 0
        if (typeof this.scrollBox.scrollTo === 'function') {
          this.scrollBox.scrollTo({ top: nextTop, behavior: 'smooth' })
        } else {
          this.scrollBox.scrollTop = nextTop
        }
      }

      controller.setActive = function (id, options) {
        if (!id || !this.sectionMap[id]) return
        if (this.activeId === id && !(options && options.force)) return
        this.activeId = id
        for (var b = 0; b < this.buttons.length; b++) {
          if (this.buttons[b].getAttribute('data-menu-target') === id) {
            this.buttons[b].classList.add('is-active')
          } else {
            this.buttons[b].classList.remove('is-active')
          }
        }
        for (var s = 0; s < this.sections.length; s++) {
          if (this.sections[s].getAttribute('data-menu-section') === id) {
            this.sections[s].classList.add('is-active')
          } else {
            this.sections[s].classList.remove('is-active')
          }
        }
        if (options && options.scroll) {
          this.scrollToId(id)
        }
        if (options && options.lock) {
          this.lockedByScroll = true
          var self = this
          if (this.lockTimer) {
            clearTimeout(this.lockTimer)
          }
          this.lockTimer = setTimeout(function () {
            self.lockedByScroll = false
          }, 600)
        }
      }

      controller.handleNavClick = function (event) {
        var target = event.target
        while (target && target !== nav) {
          var key = target.getAttribute('data-menu-target')
          if (key) {
            event.preventDefault()
            controller.setActive(key, {
              force: true,
              scroll: true,
              lock: true
            })
            return
          }
          target = target.parentNode
        }
      }

      controller.handleWorkflowLink = function (event) {
        var target = event.target
        while (target && target !== root) {
          var workflowId = target.getAttribute('data-workflow-id')
          if (workflowId) {
            event.preventDefault()
            // 메뉴 클릭 시 workflow로 이동
            App.openWorkflow(workflowId)
            return
          }
          target = target.parentNode
        }
      }

      controller.syncActiveByScroll = function () {
        if (this.lockedByScroll) return
        var candidate = this.activeId
        var bestDistance = Number.POSITIVE_INFINITY
        var containerTop = this.scrollBox.getBoundingClientRect().top
        var focusLine = 0
        for (var i = 0; i < this.sections.length; i++) {
          var section = this.sections[i]
          var id = section.getAttribute('data-menu-section')
          var rect = section.getBoundingClientRect()
          var relativeTop = rect.top - containerTop
          var relativeBottom = rect.bottom - containerTop
          if (relativeTop <= focusLine && relativeBottom > focusLine) {
            candidate = id
            break
          }
          var diff = Math.abs(relativeTop - focusLine)
          if (diff < bestDistance) {
            bestDistance = diff
            candidate = id
          }
        }
        if (candidate) {
          this.setActive(candidate, { force: true })
        }
      }

      controller.onScroll = function () {
        if (controller.scrollTimeout) {
          clearTimeout(controller.scrollTimeout)
        }
        controller.scrollTimeout = setTimeout(function () {
          controller.scrollTimeout = null
          controller.syncActiveByScroll()
        }, 80)
      }

      controller.bindEvents = function () {
        if (nav) {
          nav.addEventListener('click', controller.handleNavClick)
        }
        root.addEventListener('click', controller.handleWorkflowLink)
        controller.scrollHandler = function () {
          controller.onScroll()
        }
        controller.scrollBox.addEventListener(
          'scroll',
          controller.scrollHandler
        )
        controller.syncActiveByScroll()
      }

      controller.destroy = function () {
        if (nav) {
          nav.removeEventListener('click', controller.handleNavClick)
        }
        root.removeEventListener('click', controller.handleWorkflowLink)
        if (controller.scrollHandler) {
          controller.scrollBox.removeEventListener(
            'scroll',
            controller.scrollHandler
          )
        }
        if (controller.scrollTimeout) {
          clearTimeout(controller.scrollTimeout)
          controller.scrollTimeout = null
        }
        if (controller.lockTimer) {
          clearTimeout(controller.lockTimer)
          controller.lockTimer = null
        }
      }

      var initialId = null
      for (var b = 0; b < buttons.length; b++) {
        if (buttons[b].classList.contains('is-active')) {
          initialId = buttons[b].getAttribute('data-menu-target')
          break
        }
      }
      if (!initialId && sections.length) {
        initialId = sections[0].getAttribute('data-menu-section')
      }
      if (initialId) {
        controller.setActive(initialId, { force: true })
      }

      controller.bindEvents()
      return controller
    }
  },

  // workflow: LNB/툴팁/iframe src만 담당하는 업무별 체험 컨트롤러
  workflow: {
    create: function (root, data) {
      if (!root || !data) return null
      var flowRoot = root.querySelector('[data-flow]')
      var stageFrame = root.querySelector('iframe.stage')
      if (!flowRoot || !stageFrame) return null
      var tooltipRoot = root.querySelector('[data-tooltip]')
      if (!tooltipRoot) {
        tooltipRoot = document.createElement('div')
        tooltipRoot.className = 'tooltip'
        tooltipRoot.setAttribute('data-tooltip', '')
        tooltipRoot.textContent = ''
        tooltipRoot.style.display = 'none'
        root.insertBefore(tooltipRoot, stageFrame)
      }

      var controller = {
        root: root,
        data: data,
        flowRoot: flowRoot,
        stageFrame: stageFrame,
        tooltipRoot: tooltipRoot,
        currentStepId: null,
        sectionMap: {},
        flowClickHandler: null,
        tooltipText: ''
      }

      controller.init = function () {
        this._ensureFlowStructure()
        this._buildSectionMap()
        this.renderFlow()
        this.renderPlayback()
        var steps = this.data.steps || []
        var firstStep = steps.length ? steps[0].id : null
        this.setStep(firstStep)
      }

      controller._buildSectionMap = function () {
        this.sectionMap = {}
        var steps = this.data.steps || []
        for (var i = 0; i < steps.length; i++) {
          var step = steps[i]
          if (!step || !step.id) continue
          this.sectionMap[step.id] = {
            id: step.id,
            index: step.index || i + 1,
            title: step.title || this.data.title || '',
            subtitle: step.subtitle || '',
            page: step.page || step.samplePage || '',
            raw: step
          }
        }
      }

      controller._ensureFlowStructure = function () {
        if (!this.flowRoot.querySelector('[data-steps]')) {
          this.flowRoot.innerHTML =
            '<div class="flow-head"><span data-flow-category></span>' +
            '<span data-flow-heading></span></div>' +
            '<ul class="flow-steps" data-steps></ul>'
        }
      }

      controller.renderFlow = function () {
        var categoryEl = this.flowRoot.querySelector('[data-flow-category]')
        var headingEl = this.flowRoot.querySelector('[data-flow-heading]')
        if (categoryEl) {
          categoryEl.textContent = this.data.category || ''
        }
        if (headingEl) {
          var titleText = this.data.title || ''
          var pdfUrl = this.data.pdfUrl || ''
          headingEl.innerHTML = ''
          var titleSpan = document.createElement('span')
          titleSpan.className = 'flow-heading-title'
          this._renderMultilineText(titleSpan, titleText)
          if (pdfUrl) {
            var button = document.createElement('a')
            button.setAttribute('href', pdfUrl)
            button.setAttribute('target', '_blank')
            button.setAttribute('rel', 'noopener noreferrer')
            button.className = 'flow-heading-download'
            button.textContent = 'PDF 다운로드'
            titleSpan.appendChild(button)
          }
          headingEl.appendChild(titleSpan)
        }
        var list = this.flowRoot.querySelector('[data-steps]')
        if (!list) return
        list.innerHTML = ''
        var steps = this.data.steps || []
        for (var i = 0; i < steps.length; i++) {
          var step = steps[i]
          var item = document.createElement('li')
          item.className = 'flow-step'
          item.setAttribute('data-step', step.id || '')
          item.innerHTML =
            '<button type="button" class="flow-step-button">' +
            '<span class="flow-step-index">' +
            (step.index || i + 1) +
            '</span>' +
            '<span class="flow-step-body">' +
            '<strong class="flow-step-title"></strong>' +
            '</span>' +
            '</button>'
          list.appendChild(item)
          var titleEl = item.querySelector('.flow-step-title')
          var subtitleText = step.subtitle || ''
          if (subtitleText) {
            var bodyEl = item.querySelector('.flow-step-body')
            if (bodyEl) {
              var subtitleEl = document.createElement('span')
              subtitleEl.className = 'flow-step-subtitle'
              this._renderMultilineText(subtitleEl, subtitleText)
              bodyEl.insertBefore(subtitleEl, titleEl)
            }
          }
          if (titleEl) {
            this._renderMultilineText(titleEl, step.title || step.name || '')
          }
        }
        this.bindFlowEvents()
      }

      controller._renderMultilineText = function (target, text) {
        if (!target) return
        target.innerHTML = ''
        var value = text || ''
        var lines = value.split(/\r?\n/)
        for (var i = 0; i < lines.length; i++) {
          if (i > 0) {
            target.appendChild(document.createElement('br'))
          }
          target.appendChild(document.createTextNode(lines[i]))
        }
      }

      controller.bindFlowEvents = function () {
        if (this.flowClickHandler) {
          this.flowRoot.removeEventListener('click', this.flowClickHandler)
        }
        var self = this
        this.flowClickHandler = function (event) {
          var target = event.target
          while (target && target !== self.flowRoot) {
            var stepId = target.getAttribute('data-step')
            if (stepId) {
              event.preventDefault()
              self.setStep(stepId)
              return
            }
            target = target.parentNode
          }
        }
        this.flowRoot.addEventListener('click', this.flowClickHandler)
      }

      controller.setStep = function (stepId) {
        if (!stepId) return
        this.currentStepId = stepId
        var items = this.flowRoot.querySelectorAll('[data-step]')
        for (var reset = 0; reset < items.length; reset++) {
          items[reset].classList.remove('is-completed')
        }
        for (var i = 0; i < items.length; i++) {
          var id = items[i].getAttribute('data-step')
          if (id === stepId) {
            items[i].classList.add('is-active')
            items[i].classList.remove('is-completed')
          } else {
            items[i].classList.remove('is-active')
            if (this.sectionMap[id] && this.sectionMap[id].index) {
              var current = this.sectionMap[stepId]
              if (current && this.sectionMap[id].index < current.index) {
                items[i].classList.add('is-completed')
              } else {
                items[i].classList.remove('is-completed')
              }
            }
          }
        }
        this.renderStage()
      }

      controller.renderStage = function () {
        if (!App.state.workflowReady) return
        var section = this.sectionMap[this.currentStepId]
        if (section && section.page && this.stageFrame) {
          var frame = this.stageFrame
          // menu.json의 page가 상대경로라면 pages 디렉터리 기준으로 보정한다.
          var basePath = '/cont/tutorial/pages/'
          var pagePath = section.page
          if (pagePath.indexOf('/cont/') !== 0) {
            pagePath = basePath + pagePath
          }
          frame.src = pagePath
          var titleText =
            section.title || (this.data && this.data.title) || 'workflow stage'
          frame.title = titleText
        }
      }

      // clearStage: start 팝업 표시 동안 이전 iframe/툴팁 화면을 비워둔다.
      controller.clearStage = function () {
        if (!this.stageFrame) return
        this.stageFrame.src = 'about:blank'
        this.stageFrame.title = ''
        if (this.tooltipRoot) {
          this.tooltipRoot.textContent = ''
          this.tooltipRoot.style.display = 'none'
        }
      }

      controller.renderPlayback = function () {}

      // setTooltip: 툴팁 텍스트 변경 + 페이드 전환(iframe notify 전용)
      controller.setTooltip = function (text) {
        this.tooltipText = text || ''
        if (!this.tooltipRoot) return
        if (!this.tooltipText) {
          this.tooltipRoot.style.display = 'none'
          return
        }
        this.tooltipRoot.style.display = ''
        var parent = this.tooltipRoot.parentNode
        if (!parent) {
          this._renderMultilineText(this.tooltipRoot, this.tooltipText)
          return
        }
        var nextTooltip = document.createElement('div')
        nextTooltip.className = this.tooltipRoot.className || 'tooltip'
        nextTooltip.setAttribute('data-tooltip', '')
        nextTooltip.style.opacity = '0'
        nextTooltip.style.transition = 'opacity 2000ms ease'
        nextTooltip.style.display = ''
        this._renderMultilineText(nextTooltip, this.tooltipText)
        parent.insertBefore(nextTooltip, this.tooltipRoot.nextSibling)
        var prevTooltip = this.tooltipRoot
        prevTooltip.style.transition = 'opacity 2000ms ease'
        prevTooltip.style.opacity = '0'
        this.tooltipRoot = nextTooltip
        setTimeout(function () {
          if (prevTooltip && prevTooltip.parentNode) {
            prevTooltip.parentNode.removeChild(prevTooltip)
          }
        }, 220)
        var triggerFade = function () {
          nextTooltip.style.opacity = '1'
        }
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(triggerFade)
          })
        } else {
          setTimeout(triggerFade, 0)
        }
      }

      // handleBridgeEvent: iframe notify({ type, data }) 처리
      // type: tooltip(문구 변경), autoplay(true/false), finish(현재 스텝 자동재생 종료)
      controller.handleBridgeEvent = function (payload) {
        var eventType = payload && payload.type
        var eventData = payload ? payload.data : null
        if (eventType === 'tooltip') {
          this.setTooltip(eventData || '')
        }
        if (eventType === 'autoplay') {
          App.state.workflowAutoPlay = !!eventData
        }
        if (eventType === 'finish') {
          this.handleFinishEvent()
        }
      }

      controller.getStepIndex = function () {
        var meta = this.sectionMap[this.currentStepId]
        return meta ? meta.index : null
      }

      controller.getStepCount = function () {
        return (this.data.steps || []).length
      }

      controller.goToStepByIndex = function (index) {
        var steps = this.data.steps || []
        if (!steps.length) return false
        var target = steps[index - 1]
        if (!target || !target.id) return false
        this.setStep(target.id)
        return true
      }

      controller.isLastStep = function () {
        var steps = this.data.steps || []
        if (!steps.length) return false
        var currentIndex = this.getStepIndex()
        return currentIndex === steps.length
      }

      // handleFinishEvent: 마지막 스텝 여부/자동재생 상태에 따라 다음 동작 분기
      controller.handleFinishEvent = function () {
        if (this.isLastStep()) {
          App.modules.dialog.open('finish', { finishType: 'menu' })
          return
        }
        if (App.state.workflowAutoPlay) {
          App.modules.dialog.open('finish', { finishType: 'step' })
          return
        }
        App.goToNextStep()
      }

      // bindBridge: iframe에서 App 기능을 호출할 수 있도록 브릿지 메서드를 노출
      controller.bindBridge = function () {
        var self = this
        App.workflowBridge = {
          __owner: self,
          notify: function (payload) {
            self.handleBridgeEvent(payload || {})
          },
          getAutoPlayState: function () {
            return !!App.state.workflowAutoPlay
          }
        }
      }

      controller._findStepMeta = function (stepId) {
        var steps = this.data.steps || []
        for (var i = 0; i < steps.length; i++) {
          if (steps[i].id === stepId) {
            return steps[i]
          }
        }
        return null
      }

      controller.destroy = function () {
        if (this.flowClickHandler) {
          this.flowRoot.removeEventListener('click', this.flowClickHandler)
          this.flowClickHandler = null
        }
        if (App.workflowBridge && App.workflowBridge.__owner === this) {
          App.workflowBridge = null
        }
      }

      controller.init()
      controller.bindBridge()
      return controller
    }
  }
}

// requestHtml: HTML 파셜을 XHR로 받아온 뒤 콜백에 전달한다.
// - url: 불러올 정적 파일 경로
// - callback: (error, html) 형태로 응답을 처리할 함수
App.requestHtml = function (url, callback) {
  var xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return
    if (xhr.status >= 200 && xhr.status < 300) {
      callback(null, xhr.responseText)
    } else {
      callback(new Error('Failed to load: ' + url))
    }
  }
  xhr.send()
}

// requestJson: JSON 데이터를 불러오고 파싱까지 담당한다.
// - url: JSON 소스 경로
// - callback: (error, data) 시그니처
App.requestJson = function (url, callback) {
  var xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) return
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        callback(null, JSON.parse(xhr.responseText))
      } catch (e) {
        callback(e || new Error('Invalid JSON: ' + url))
      }
    } else {
      callback(new Error('Failed to load: ' + url))
    }
  }
  xhr.send()
}

// getWorkflowPage: menu.json에서 workflowId와 매칭되는 데이터 반환.
App.getWorkflowPage = function (workflowId) {
  var pages = this.state.workflowPages || []
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].pageId === workflowId) {
      return pages[i]
    }
  }
  return null
}

// ensureWorkflowPages: workflow 데이터가 없으면 menu.json을 선로딩한다.
// - menu 화면에서 팝업을 띄우기 전에 workflow 데이터가 필요할 때 사용.
App.ensureWorkflowPages = function (callback) {
  if (this.state.workflowPages && this.state.workflowPages.length) {
    if (callback) callback(null, this.state.workflowPages)
    return
  }
  this.requestJson('/cont/tutorial/data/menu.json', function (err, payload) {
    if (!err && payload && payload.pages && payload.pages.length) {
      App.state.workflowPages = payload.pages
    }
    if (callback) callback(err, App.state.workflowPages || [])
  })
}

// openWorkflow: 메뉴에서 선택한 업무별 체험 ID를 저장하고 라우팅한다.
// - 선택된 메뉴 ID는 새로고침 유지를 위해 sessionStorage에 저장한다.
App.openWorkflow = function (workflowId) {
  if (workflowId) {
    this.state.workflowMenuId = workflowId
    try {
      window.sessionStorage.setItem('workflowMenuId', workflowId)
    } catch (error) {}
  }
  this.state.workflowReady = false
  if (location.hash !== '#workflow') {
    location.hash = '#workflow'
    return
  }
  var workflowRoot = document.querySelector('.workflow')
  if (workflowRoot) {
    this.initWorkflow(workflowRoot)
  }
}

// navigateByTarget: data-navigate 값만으로 라우팅을 수행한다.
// - node: 이벤트가 발생한 DOM 요소
// - defaults.navigate: 속성이 없을 때 사용할 기본 target 문자열
App.navigateByTarget = function (node, defaults) {
  defaults = defaults || {}
  var target = (node && node.getAttribute('data-navigate')) || defaults.navigate
  if (!target) return false
  return this._applyNavigation(target)
}

// _applyNavigation: 문자열을 파싱해 실제 이동을 수행한다.
App._applyNavigation = function (target) {
  if (!target) return false
  var type = target
  var payload = ''
  var delimiter = target.indexOf(':')
  if (delimiter > -1) {
    type = target.slice(0, delimiter)
    payload = target.slice(delimiter + 1)
  }
  if (type === 'workflow') {
    var workflowId = payload || null
    if (workflowId) {
      this.openWorkflow(workflowId)
      return true
    }
    return false
  }
    if (type === 'workflow-start') {
      var startId = payload || null
      if (startId) {
        this.state.workflowMenuId = startId
        try {
          window.sessionStorage.setItem('workflowMenuId', startId)
        } catch (error) {}
      }
      this.state.workflowReady = true
      if (location.hash.indexOf('#workflow') !== 0) {
        location.hash = '#workflow'
        return true
      }
      if (this.state.workflowController) {
        this.state.workflowController.renderStage()
      }
      return true
  }
  if (type === 'step-next') {
    if (payload === 'stop') {
      this.state.workflowAutoPlay = false
    } else if (payload === 'keep') {
      this.state.workflowAutoPlay = true
    }
    this.goToNextStep()
    return true
  }
  if (type === 'menu-next') {
    this.goToNextMenu()
    return true
  }
  if (type === 'url') {
    if (payload) {
      location.href = payload
      return true
    }
    return false
  }
  if (type === 'hash') {
    var hashValue = payload || ''
    if (!hashValue) return false
    location.hash = hashValue.charAt(0) === '#' ? hashValue : '#' + hashValue
    return true
  }
  // type이 지정되지 않은 경우 해시로 취급
  var normalized = target.charAt(0) === '#' ? target : '#' + target
  location.hash = normalized
  return true
}

// goToNextStep: 현재 workflow에서 다음 스텝으로 이동
App.goToNextStep = function () {
  var controller = this.state.workflowController
  if (!controller) return false
  var currentIndex = controller.getStepIndex()
  var total = controller.getStepCount()
  if (!currentIndex || !total) return false
  var nextIndex = Math.min(total, currentIndex + 1)
  return controller.goToStepByIndex(nextIndex)
}

// goToNextMenu: 메뉴 순서 기준으로 다음 메뉴로 이동
App.goToNextMenu = function () {
  var pages = this.state.workflowPages || []
  if (!pages.length) return false
  var currentId = this.state.workflowMenuId
  var currentIndex = -1
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].pageId === currentId) {
      currentIndex = i
      break
    }
  }
  var nextIndex = currentIndex > -1 ? currentIndex + 1 : 0
  if (nextIndex >= pages.length) {
    nextIndex = 0
  }
  this.openWorkflow(pages[nextIndex].pageId)
  return true
}

// loadHeader: 공통 헤더 HTML을 주입하고 현재 페이지 상태에 맞춰 초기화한다.
// - callback: 헤더 로드 이후 후속 작업을 이어갈 함수
App.loadHeader = function (callback) {
  this.requestHtml(
    '/cont/tutorial/components/header.html',
    function (err, html) {
      if (err) {
        if (callback) callback(err)
        return
      }
      var header = document.querySelector('#appHeader')
      if (!header) return
      header.innerHTML = html
      App.updateHeaderState(Store.state.currentPage)
      if (callback) callback()
    }
  )
}

// updateHeaderBadge: 라우트 메타 정보에 기록된 뱃지 구성을 반영한다.
// - page: Router에서 전달되는 현재 페이지 키
App.updateHeaderBadge = function (page) {
  var badge = document.querySelector('#header-badge')
  if (!badge) return
  var meta = Router.pageMeta[page] || {}
  var badgeConfig = meta.badge || { text: '', className: '' }
  badge.textContent = badgeConfig.text || ''
  badge.classList.remove('new', 'guide')
  if (badgeConfig.text) {
    if (badgeConfig.className) badge.classList.add(badgeConfig.className)
    badge.classList.remove('is-hidden')
  } else {
    badge.classList.add('is-hidden')
  }
}

// updateHeaderNavigation: 홈/메뉴 버튼을 페이지별 요건에 맞춰 토글한다.
// - page: Router 현재 페이지 키
App.updateHeaderNavigation = function (page) {
  var header = document.querySelector('#appHeader')
  if (!header) return
  var meta = Router.pageMeta[page] || {}
  var homeLink = header.querySelector('a[data-page="intro"]')
  if (homeLink) {
    var showHome =
      typeof meta.showHome === 'boolean' ? meta.showHome : page !== 'intro'
    homeLink.hidden = !showHome
    homeLink.style.display = showHome ? '' : 'none'
  }
  var menuLink = header.querySelector('a[data-page="menu"]')
  if (menuLink) {
    var showMenu = typeof meta.showMenu === 'boolean' ? meta.showMenu : false
    menuLink.hidden = !showMenu
    menuLink.style.display = showMenu ? '' : 'none'
  }
}

// updateHeaderState: 뱃지/홈/메뉴 등의 헤더 요소를 통합 갱신한다.
// - page: Store가 보관하는 현재 페이지 키
App.updateHeaderState = function (page) {
  this.updateHeaderBadge(page)
  this.updateHeaderNavigation(page)
  var header = document.querySelector('#appHeader')
  if (header) {
    header.classList.toggle('is-onboarding', page === 'onboarding')
  }
}

// applyInitialWorkflowTarget: 해시 파라미터의 menuId를 workflow 진입 전에 저장한다.
App.applyInitialWorkflowTarget = function () {
  var hash = location.hash || ''
  if (hash.indexOf('#workflow') !== 0) return
  var queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return
  var query = hash.slice(queryIndex + 1)
  if (!query) return
  var parts = query.split('&')
  for (var i = 0; i < parts.length; i++) {
    var pair = parts[i].split('=')
    if (pair[0] === 'menuId' && pair[1]) {
      var menuId = decodeURIComponent(pair[1])
      this.state.workflowMenuId = menuId
      try {
        window.sessionStorage.setItem('workflowMenuId', menuId)
      } catch (error) {}
      break
    }
  }
}

// runPageScripts: 새로 로드된 파셜에서 필요한 화면 컨트롤러를 재생성한다.
//   * 온보딩, 전체 메뉴, workflow 화면별로 destroy 후 create.
App.runPageScripts = function () {
  if (
    this.state.onboardingController &&
    this.state.onboardingController.destroy
  ) {
    this.state.onboardingController.destroy()
    this.state.onboardingController = null
  }
  if (this.state.menuController && this.state.menuController.destroy) {
    this.state.menuController.destroy()
    this.state.menuController = null
  }
  var onboardingRoot = document.querySelector('[data-onboarding]')
  if (onboardingRoot) {
    this.state.onboardingController =
      this.modules.onboarding.create(onboardingRoot)
  }
  var menuRoot = document.querySelector('[data-menu-page]')
  if (menuRoot) {
    this.state.menuController = this.modules.menu.create(menuRoot)
  }
  if (this.state.workflowController) {
    this.state.workflowController.destroy()
    this.state.workflowController = null
  }
  var workflowRoot = document.querySelector('.workflow')
  if (workflowRoot && workflowRoot.querySelector('[data-flow]')) {
    this.initWorkflow(workflowRoot)
  }
}

// handleRouteRendered: Router가 HTML을 렌더링한 뒤 상태 및 헤더를 동기화한다.
// - page: 방금 렌더링된 라우트 키
// - meta: 페이지 타이틀/뱃지 표기 등 부가 정보
App.handleRouteRendered = function (page, meta) {
  Store.setPage(page)
  this.updateHeaderState(page)
  if (page === 'onboarding') {
    // 새로고침이 아닌 일반 진입은 항상 hero로 시작하도록 저장값 초기화
    try {
      var navType = window.performance && performance.navigation
      if (!navType || navType.type !== 1) {
        window.sessionStorage.removeItem('onboardingStep')
        // 온보딩 탭 상태도 새 진입 시 기본값으로 초기화
        window.sessionStorage.removeItem('onboardingTab:1')
        window.sessionStorage.removeItem('onboardingTab:2')
        window.sessionStorage.removeItem('onboardingTab:3')
      }
    } catch (error) {}
  }
  if (meta && meta.title) {
    document.title = meta.title
  }
  this.runPageScripts()
}

// initWorkflow: workflow 페이지가 로드되었을 때 JSON을 불러와 컨트롤러를 생성한다.
// - root: workflow 파셜 루트 엘리먼트
App.initWorkflow = function (root) {
  var self = this
  var requestId = ++this.state.workflowRequestId
  this.state.workflowAutoPlay = false
  this.state.workflowReady = false
  // 세션에 저장된 메뉴 ID가 있으면 새로고침 후에도 해당 메뉴를 유지한다.
  if (!this.state.workflowMenuId) {
    try {
      this.state.workflowMenuId =
        window.sessionStorage.getItem('workflowMenuId') || null
    } catch (error) {}
  }
  this.requestJson('/cont/tutorial/data/menu.json', function (err, payload) {
    if (requestId !== self.state.workflowRequestId) return
    if (err) {
      return
    }
    if (payload && payload.pages && payload.pages.length) {
      self.state.workflowPages = payload.pages
    }
    var entry = null
    var targetId = self.state.workflowMenuId
    if (payload) {
      if (payload.pages && payload.pages.length) {
        if (targetId) {
          for (var i = 0; i < payload.pages.length; i++) {
            if (payload.pages[i].pageId === targetId) {
              entry = payload.pages[i]
              break
            }
          }
        }
        if (!entry) {
          entry = payload.pages[0]
        }
      } else if (payload.pageId) {
        entry = payload
      }
    }
    if (!entry) {
      return
    }
    if (!targetId && entry.pageId) {
      self.state.workflowMenuId = entry.pageId
    }
    if (self.state.workflowController) {
      self.state.workflowController.destroy()
    }
    self.state.workflowController = self.modules.workflow.create(root, entry)
    if (
      self.state.workflowController &&
      self.state.workflowController.clearStage
    ) {
      self.state.workflowController.clearStage()
    }
    if (self.modules.dialog && self.modules.dialog.open) {
      self.modules.dialog.open('start', {
        workflowId: entry.pageId,
        pageId: entry.pageId,
        title: entry.title || '',
        info: entry.info || '',
        infoList: entry.infoList || null
      })
    }
  })
}

// bindHistory: popstate 이벤트를 감지해 온보딩 스텝 상태를 복원한다.
App.bindHistory = function () {
  var handler = function (event) {
    if (
      App.state.onboardingController &&
      event.state &&
      typeof event.state.onboardingStep === 'number'
    ) {
      App.state.onboardingController.goTo(event.state.onboardingStep, {
        skipHistory: true,
        silent: false
      })
    }
  }
  window.addEventListener('popstate', handler)
  this._historyHandler = handler
}

// init: 헤더를 로드한 뒤 라우터를 실행하고 popstate 핸들러를 연결한다.
App.init = function () {
  var self = this
  if (this.modules.dialog && this.modules.dialog.init) {
    this.modules.dialog.init()
  }
  this.applyInitialWorkflowTarget()
  this.loadHeader(function (err) {
    if (err) return
    Router.init({
      onRendered: function (page, meta) {
        self.handleRouteRendered(page, meta)
      }
    })
    self.bindHistory()
  })
}

Store.subscribe(function (state) {
  App.updateHeaderState(state.currentPage)
})

App.init()
