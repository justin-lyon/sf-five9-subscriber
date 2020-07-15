({
  requestConfiguration: function (cmp, helper) {
    const action = cmp.get('c.getFive9Config')
    return helper.promisify(action)
      .then(res => {
        const data = res.getReturnValue()
        const { isFive9User, resources } = JSON.parse(data)

        const config = resources.reduce((acc, val) => {
          acc[val.DeveloperName] = val
          return acc
        }, {})

        return { isFive9User, config }
      })
  },

  start: function (cmp, helper) {
    return helper.findConnection(cmp, helper)
      .then(data => {
        console.log('f9 metadata', data)
        cmp.set('v.five9data', data)
        return helper.getCallVariables(cmp, helper)
      })
      .then(data => {
        console.log('f9 callAttributes', data)
        cmp.set('v.callAttributes', data)
        return helper.connectSocket(cmp, helper)
      })
      .catch(error => {
        console.error('Error finding connection', error)
        throw new Error('Could not establish connection.')
      })
  },

  // Recursively invoke getMetadata every 5s until successful
  findConnection: function (cmp, helper) {
    return helper.getMetadata(cmp, helper)
      .then(data => {
        if (!data || data.five9ExceptionDetail) {
          return new Promise($A.getCallback(resolve => {
            let timeout = cmp.get('v.timeout')

            if (timeout) clearTimeout(timeout)

            timeout = setTimeout(() => {
              resolve(helper.findConnection(cmp, helper))
            }, 5 * 1000)

            cmp.set('v.timeout', timeout)
          }))
        }

        console.log('connected', data)
        clearTimeout(cmp.get('v.timeout'))
        cmp.set('v.timeout', null)
        return data
      })
  },

  connectSocket: function (cmp, helper) {
    if (cmp.get('v.socket')) return

    const five9data = cmp.get('v.five9data')
    const config = cmp.get('v.config').WebSocket

    if (!five9data) throw new Error('User is not yet connected to Five9.')
    if (!config) throw new Error('Missing required FiveNineResource__mdt.')

    const userId = cmp.get('v.userId')

    const urlparts = [
      five9data.metadata.dataCenters[0].apiUrls[0].host,
      config.ResourceURL__c,
      userId]

    const socket = new WebSocket('wss://' + urlparts.join('/'))

    socket.onopen = () => { helper.startHeart(cmp, helper) }
    socket.onmessage = event => { helper.handleMessage(cmp, helper, event) }
    socket.onclose = event => { helper.cleanUp(cmp, helper, event) }

    const options = { once: true }
    window.addEventListener('beforeunload', () => {
      socket.close()
    }, options)

    console.log('socket connected', socket)
    cmp.set('v.socket', socket)
  },

  getMetadata: function (cmp, helper) {
    const config = cmp.get('v.config').Metadata

    if (!config) throw new Error('Missing required FiveNineResource__mdt.')

    const urlparts = [
      config.BaseURL__c,
      config.ResourceURL__c]

    return helper.makeRequest('GET', 'https://' + urlparts.join('/'))
      .then(res => res.json())
  },

  getCallVariables: function (cmp, helper) {
    const five9data = cmp.get('v.five9data')
    const config = cmp.get('v.config').CallVariables

    if (!five9data) throw new Error('User is not yet connected to Five9.')
    if (!config) throw new Error('Missing required FiveNineResource__mdt.')

    const five9OrgId = five9data.orgId

    const urlparts = [
      five9data.metadata.dataCenters[0].apiUrls[0].host,
      config.ResourceURL__c.replace('{five9OrgId}', five9OrgId)]

    return helper.makeRequest('GET', 'https://' + urlparts.join('/'))
      .then(res => res.json())
  },

  startHeart: function (cmp, helper) {
    const heartbeat = setInterval($A.getCallback(() => {
      let skippedBeats = cmp.get('v.skippedBeats')
      const socket = cmp.get('v.socket')
      skippedBeats++
      cmp.set('v.skippedBeats', skippedBeats)
      socket.send('ping')

      if (skippedBeats > 1) {
        // Something is wrong, going into cardiac arrest
        // Restart the connection!
        helper.defibrillate(cmp, helper)
      }
    }), 15 * 1000)
    cmp.set('v.heartbeat', heartbeat)
  },

  // Websocket Event, not standard aura event
  handleMessage: function (cmp, helper, event) {
    const PONG = '1202'
    const EVENT_CALL_CREATED = '3'
    const EVENT_CALL_UPDATED = '4'
    const EVENT_CALL_DELETED = '5'
    const TYPE_CODES = [
      PONG,
      EVENT_CALL_CREATED,
      EVENT_CALL_UPDATED,
      EVENT_CALL_DELETED]

    const data = JSON.parse(event.data)

    const summary = {
      eventId: data.context.eventId,
      eventReason: data.context.eventReason,
      state: !!data.payLoad ? data.payLoad.state : null,
    }

    if (TYPE_CODES.includes(summary.eventId)) {

      const callData = helper.mapCallVariables(cmp, data.payLoad)
      summary.sessionId = callData && callData.call ? callData.call.session_id : null

      // Emit Aura Events to the Parent Aura cmp
      helper.emitMessage(cmp, summary)

      if (summary.eventId === PONG) {
        cmp.set('v.skippedBeats', 0)
      }
    }
  },

  // Websocket Event, not standard aura event
  cleanUp: function (cmp, helper, event) {
    console.log('closing ws', event)
    clearInterval(cmp.get('v.heartbeat'))
    cmp.set('v.heartbeat', null)

    // Connection closed from Server, try to restart
    if (event.code === 1003) {
      helper.defibrillate(cmp, helper)
    }
  },

  emitMessage: function (cmp, summary) {
    const message = cmp.getEvent('socketMessage')
    message.setParams({
      detail: summary
    })
    message.fire()
  },

  makeRequest: function (method, endpoint, body) {
    return fetch(endpoint, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    })
      .catch(error => {
        console.error('Error making request', error)
        throw new Error(error)
      })
  },

  mapCallVariables: function (cmp, call) {
    if (call && call.variables) {
      const callAttributes = cmp.get('v.callAttributes')

      const callData = callAttributes.reduce((acc, val) => {
        if (call.variables[val.id]) {
          const group = val.group.toLowerCase()
          if (!acc[group]) acc[group] = {}

          acc[group][val.name] = call.variables[val.id]
        }
        return acc
      }, {})

      return callData
    }
  },

  // Restart the websocket
  defibrillate: function (cmp, helper) {
    clearTimeout(cmp.get('v.timeout'))

    cmp.set('v.five9data', null)
    cmp.set('v.timeout', null)
    cmp.set('v.skippedBeats', 0)

    const socket = cmp.get('v.socket')
    if (socket) {
      socket.close()
      cmp.set('v.socket', null)
    }

    helper.start(cmp, helper)
  },

  promisify: function (auraAction) {
    return new Promise($A.getCallback(function (resolve, reject) {
      auraAction.setCallback(this, function (res) {
        const state = res.getState();
        if (state === "SUCCESS") {
          resolve(res);
        } else {
          reject(res);
        }
      });

      $A.enqueueAction(auraAction);
    }));
  }
})