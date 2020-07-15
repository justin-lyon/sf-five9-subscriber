({
  init: function (cmp, event, helper) {
    const userId = $A.get('$SObjectType.CurrentUser.Id')
    cmp.set('v.userId', userId)

    helper.requestConfiguration(cmp, helper)
      .then(data => {
        cmp.set('v.config', data.config)
        if (data.isFive9User) {
          return helper.start(cmp, helper)
        }
      })
      .catch(error => {
        console.error('error during initialization', error)
        helper.emitMessage(cmp, { isError: true, error })
      })
  }
})