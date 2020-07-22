# sf-five-subscriber

This Aura Component subscribes to Five9's WebSocket API and converts WebSocket Messages into Aura Component Events.

## Supporting Configuration

The below Metadata Types are included in this project. CORs and CSP origin URLs should be confirmed with your Five9 Support Team. It is included in this project as an example. The Five9 APIs are provided by data centers that are determined at run-time.

| Metadata Type | Description |
| --- | --- |
| CorsWhitelistOrigin | Whitelist the Five9 Domain so we can make requests from aura directly to five9. |
| CspTrustedSite | Allow content from Five9 Domains and Subdomains in Salesforce. |
| CustomMetadata | Configurable Settings for Five9 Service Resources |

## Event Types

These Event Type Codes come pre-configured in this repo. These are the primary events that the Aura Component monitors for. When a message corresponding to these Type Codes is emitted over the websocket, a summary of the message is emitted as a Component Event. Manage the Event Type Codes that you are subscribed to by managing FiveNineTypeCode__mdt Records.

Regardless of the Type Codes in custom metadata, this socket will always observe the '1202' PONG type code.

Type Codes are Strings unless otherwise specified.

Refer to the Five9 Websocket API documentation for further details.

| Event Type Code | Event Type Name | Description |
| --- | --- | --- |
| '1202' | PONG | Keep alive, socket heartbeat. If two PONG are missed, then the subscriber attempts to restart the socket |
| '3' | EVENT_CALL_CREATED | When a new call begins for a given agent. Can be a new call or when recieving a transfer. |
| '4' | EVENT_CALL_UPDATED | Any status changes to an active call, such has changing from offered (dialing) to talking |
| '5' | EVENT_CALL_DELETED | The call has ended. |

## FiveNineSocketAuraService

This Apex AuraService provides base configuration on init. It checks if the current user is configured to a Call Center starting with the text `"Five9"`. If the current user does not meet this criteria, the aura component silently aborts.

## Usage

Compose the FiveNineSocketAPI component into your component. Recommend that your component is on the Console Utility Bar where it will always be active.

```html
<!-- MyParent.cmp -->
<aura:component access="global" implements="lightning:backgroundUtilityItem">

  <aura:handler name="socketMessage" event="c:E_Message" action="{!c.onMessage}" />

  <c:FiveNineSocketAPI />
</aura:component>
```
```js
// MyParentController.js
({
  onMessage: function (cmp, event, helper) {
    helper.handleFive9Message(cmp, event, helper)
  }
})
```
```js
// MyParentHelper.js
({
  handleFive9Message: function (cmp, event, helper) {
    const detail = event.getParams().detail
    if (detail.isError) {
      console.error('error', JSON.parse(JSON.stringify(detail.error.message)))
      // Handle Error

    } else if (helper.isCallStart(detail)) {

      console.log('callStart', JSON.parse(JSON.stringify(detail)))
      // Handle Call Start

    } else if (helper.isCallEnd(detail)) {

      console.log('dispositioned', JSON.parse(JSON.stringify(detail)))
      // Handle Call End

    } else {

      console.log('other event', JSON.parse(JSON.stringify(detail)))
    }
  },

  isCallStart: function (detail) {
    return detail.eventId === "4"
      && (detail.eventReason === "UPDATED" || detail.eventReason === "CONNECTED")
      && detail.state === "TALKING"
      && detail.sessionId
  },

  isCallEnd: function (detail) {
    return detail.eventId === "5"
      && detail.eventReason === "DISPOSITIONED"
      && detail.state === "FINISHED"
      && detail.sessionId
  }
})
```