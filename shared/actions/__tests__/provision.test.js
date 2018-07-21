// @flow
/* eslint-env jest */
import * as I from 'immutable'
import * as Types from '../../constants/types/provision'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Constants from '../../constants/provision'
import * as Tabs from '../../constants/tabs'
import * as ProvisionGen from '../provision-gen'
import * as RouteTree from '../route-tree'
import * as Saga from '../../util/saga'
import HiddenString from '../../util/hidden-string'
import type {TypedState} from '../../constants/reducer'
import {_testing} from '../provision'
import reducer from '../../reducers/provision'
import {RPCError} from '../../util/errors'

const noError = new HiddenString('')

const provStateToTypedState = (provisionState: Types.State): TypedState => ({provision: provisionState}: any)
const makeNextState = (state: TypedState, action) => provStateToTypedState(reducer(state.provision, action))
const makeInit = ({method, payload}) => {
  const manager = _testing.makeProvisioningManager(false)
  const callMap = manager.getIncomingCallMap()
  const state = provStateToTypedState(Constants.makeState())
  const call = callMap[method]
  if (!call) {
    throw new Error('No call')
  }
  const response = {error: jest.fn(), result: jest.fn()}
  const put: any = call((payload: any), (response: any), state)
  if (!put || !put.PUT) {
    throw new Error('no put')
  }
  const action = put.PUT.action
  const nextState = makeNextState(state, action)
  return {action, callMap, manager, nextState, response, state}
}

describe('provisioningManagerProvisioning', () => {
  const manager = _testing.makeProvisioningManager(false)
  const callMap = manager.getIncomingCallMap()

  it('cancels are correct', () => {
    const keys = ['keybase.1.gpgUi.selectKey', 'keybase.1.loginUi.getEmailOrUsername']
    keys.forEach(k => {
      const response = {error: jest.fn(), result: jest.fn()}
      // $FlowIssue
      callMap[k](undefined, response, undefined)
      expect(response.result).not.toHaveBeenCalled()
      expect(response.error).toHaveBeenCalledWith({
        code: RPCTypes.constantsStatusCode.scgeneric,
        desc: 'Canceling RPC',
      })
    })
  })

  it('ignores are correct', () => {
    const keys = [
      'keybase.1.loginUi.displayPrimaryPaperKey',
      'keybase.1.provisionUi.ProvisioneeSuccess',
      'keybase.1.provisionUi.ProvisionerSuccess',
      'keybase.1.provisionUi.DisplaySecretExchanged',
    ]
    keys.forEach(k => {
      const response = {error: jest.fn(), result: jest.fn()}
      // $FlowIssue
      callMap[k](undefined, response, undefined)
      expect(response.result).not.toHaveBeenCalled()
      expect(response.error).not.toHaveBeenCalled()
    })
  })
})

describe('text code happy path', () => {
  const incoming = new HiddenString('incomingSecret')
  const outgoing = new HiddenString('incomingSecret')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
      payload: {phrase: incoming.stringValue()},
    })
  })

  it('init', () => {
    const {manager, response, nextState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(nextState.provision.codePageIncomingTextCode).toEqual(incoming)
    expect(nextState.provision.error).toEqual(noError)
  })

  it('shows the code page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowCodePage({code: incoming, error: null}))
  })

  it('navs to the code page', () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['codePage'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit text code empty throws', () => {
    const {nextState} = init
    expect(() => _testing.submitTextCode(nextState)).toThrow()
  })

  it('submit text code', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitTextCode({phrase: outgoing})
    const submitState = makeNextState(nextState, submitAction)

    _testing.submitTextCode(submitState)
    expect(response.result).toHaveBeenCalledWith({code: null, phrase: outgoing.stringValue()})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitTextCode(submitState)).toThrow()
  })
})

describe('text code error path', () => {
  const phrase = new HiddenString('incomingSecret')
  const error = new HiddenString('anerror')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.DisplayAndPromptSecret',
      payload: {phrase: phrase.stringValue(), previousErr: error.stringValue()},
    })
  })

  it('init', () => {
    const {manager, response, nextState} = init
    expect(manager._stashedResponse).toEqual(response)
    expect(manager._stashedResponseKey).toEqual('keybase.1.provisionUi.DisplayAndPromptSecret')
    expect(nextState.provision.codePageIncomingTextCode).toEqual(phrase)
    expect(nextState.provision.error).toEqual(error)
  })

  it('shows the code page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowCodePage({code: phrase, error}))
  })

  it("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showCodePage(nextState)).toBeFalsy()
  })

  it("won't let submit on error", () => {
    const {response, nextState} = init
    expect(_testing.submitTextCode(nextState)).toBeFalsy()
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('submit clears error and submits', () => {
    const {response, nextState} = init
    const reply = 'reply'
    const submitAction = ProvisionGen.createSubmitTextCode({phrase: new HiddenString(reply)})
    const submitState = makeNextState(nextState, submitAction)
    expect(submitState.provision.error).toEqual(noError)

    _testing.submitTextCode(submitState)
    expect(response.result).toHaveBeenCalledWith({code: null, phrase: reply})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitTextCode(submitState)).toThrow()
  })
})

describe('device name empty', () => {
  const existingDevices = I.List()
  const init = makeInit({
    method: 'keybase.1.provisionUi.PromptNewDeviceName',
    payload: {errorMessage: '', existingDevices: null},
  })

  const {nextState} = init
  expect(nextState.provision.existingDevices).toEqual(existingDevices)
  expect(nextState.provision.error).toEqual(noError)
})

describe('device name happy path', () => {
  const existingDevices = I.List(['dev1', 'dev2', 'dev3'])
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.PromptNewDeviceName',
      payload: {errorMessage: '', existingDevices: existingDevices.toArray()},
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.existingDevices).toEqual(existingDevices)
    expect(nextState.provision.error).toEqual(noError)
  })

  it('shows device name page', () => {
    const {action} = init
    expect(action).toEqual(
      ProvisionGen.createShowNewDeviceNamePage({error: null, existingDevices: existingDevices.toArray()})
    )
  })

  it('navs to device name page', () => {
    const {nextState} = init
    expect(_testing.showNewDeviceNamePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['setPublicName'], [Tabs.loginTab, 'login']))
    )
  })

  it("don't allow submit dupe", () => {
    const {response, nextState} = init
    const name: string = (existingDevices.first(): any)
    const submitAction = ProvisionGen.createSubmitDeviceName({name})
    const submitState = makeNextState(nextState, submitAction)
    expect(submitState.provision.error.stringValue().indexOf('is already taken')).not.toEqual(-1)
    _testing.submitDeviceName(submitState)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('submit', () => {
    const {response, nextState} = init
    const name = 'new name'
    const submitAction = ProvisionGen.createSubmitDeviceName({name})
    const submitState = makeNextState(nextState, submitAction)

    _testing.submitDeviceName(submitState)
    expect(response.result).toHaveBeenCalledWith(name)
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitDeviceName(submitState)).toThrow()
  })
})

describe('device name error path', () => {
  const existingDevices = I.List([])
  const error = new HiddenString('invalid name')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.PromptNewDeviceName',
      payload: {errorMessage: error.stringValue(), existingDevices: existingDevices.toArray()},
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.existingDevices).toEqual(existingDevices)
    expect(nextState.provision.error).toEqual(error)
  })

  it('shows device page', () => {
    const {action} = init
    expect(action).toEqual(
      ProvisionGen.createShowNewDeviceNamePage({error, existingDevices: existingDevices.toArray()})
    )
  })

  it("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showNewDeviceNamePage(nextState)).toBeFalsy()
  })

  it('no submit on error', () => {
    const {response, nextState} = init
    _testing.submitDeviceName(nextState)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('update name and submit clears error and submits', () => {
    const {response, nextState} = init
    const name = 'new name'
    const submitAction = ProvisionGen.createSubmitDeviceName({name})
    const submitState = makeNextState(nextState, submitAction)
    expect(submitState.provision.error).toEqual(noError)

    _testing.submitDeviceName(submitState)
    expect(response.result).toHaveBeenCalledWith(name)
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitDeviceName(submitState)).toThrow()
  })
})

describe('other device happy path', () => {
  const mobile = ({deviceID: '0', name: 'mobile', type: 'mobile'}: any)
  const desktop = ({deviceID: '1', name: 'desktop', type: 'desktop'}: any)
  const backup = ({deviceID: '2', name: 'backup', type: 'backup'}: any)
  const rpcDevices = [mobile, desktop, backup]
  const devices = I.List(rpcDevices.map(Constants.rpcDeviceToDevice))
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseDevice',
      payload: {devices: rpcDevices},
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.devices).toEqual(devices)
    expect(nextState.provision.error).toEqual(noError)
  })

  it('shows device page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowDeviceListPage({devices: devices.toArray()}))
  })

  it('navs to device page', () => {
    const {nextState} = init
    expect(_testing.showDeviceListPage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['selectOtherDevice'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit missing', () => {
    const {nextState} = init
    expect(() => _testing.submitDeviceSelect(nextState)).toThrow()
  })

  it('submit mobile', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: mobile.name})
    const submitState = makeNextState(nextState, submitAction)
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith(mobile.deviceID)
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })

  it('submit desktop', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: desktop.name})
    const submitState = makeNextState(nextState, submitAction)
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith(desktop.deviceID)
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })

  it('submit paperkey/backup', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: backup.name})
    const submitState = makeNextState(nextState, submitAction)
    _testing.submitDeviceSelect(submitState)
    expect(response.result).toHaveBeenCalledWith(backup.deviceID)
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitDeviceSelect(submitState)).toThrow()
  })

  it('doesnt allow unknown', () => {
    const {nextState} = init
    const submitAction = ProvisionGen.createSubmitDeviceSelect({name: 'not there'})
    expect(() => reducer(nextState.provision, submitAction)).toThrow()
  })
})

describe('other device error path', () => {
  it('doesnt have errors', () => {
    // Actually no error path for chooseDevice
  })
})

describe('other device no devices', () => {
  let init
  const rpcDevices = null
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseDevice',
      payload: {devices: rpcDevices},
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.devices).toEqual(I.List())
    expect(nextState.provision.error).toEqual(noError)
  })
})

describe('choose gpg happy path', () => {
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.provisionUi.chooseGPGMethod',
      payload: {},
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.error.stringValue()).toEqual('')
  })

  it('shows gpg page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowGPGPage())
  })

  it('navs to the gpg page', () => {
    const {nextState} = init
    expect(_testing.showGPGPage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['gpgSign'], [Tabs.loginTab, 'login']))
    )
  })

  it('no submit on error', () => {
    const {response, nextState} = init
    // shouldn't really be possible, but inject an error
    const errorAction = ProvisionGen.createShowPaperkeyPage({error: new HiddenString('something')})
    const submitAction = ProvisionGen.createSubmitGPGMethod({exportKey: true})
    const errorState = makeNextState(nextState, errorAction)
    _testing.submitGPGMethod(errorState, submitAction)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
  })

  it('submit export key', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitGPGMethod({exportKey: true})
    const submitState = makeNextState(nextState, submitAction)
    _testing.submitGPGMethod(submitState, submitAction)
    expect(response.result).toHaveBeenCalledWith(RPCTypes.provisionUiGPGMethod.gpgImport)
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitGPGMethod(submitState, submitAction)).toThrow()
  })

  it('submit sign key', () => {
    const {response, nextState} = init
    const submitAction = ProvisionGen.createSubmitGPGMethod({exportKey: false})
    const submitState = makeNextState(nextState, submitAction)
    _testing.submitGPGMethod(submitState, submitAction)
    expect(response.result).toHaveBeenCalledWith(RPCTypes.provisionUiGPGMethod.gpgSign)
    expect(response.error).not.toHaveBeenCalled()
    // only submit once
    expect(() => _testing.submitGPGMethod(submitState, submitAction)).toThrow()
  })
})

describe('passphrase happy path', () => {
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: null,
          type: RPCTypes.passphraseCommonPassphraseType.passPhrase,
        },
      },
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.error).toEqual(noError)
  })

  it('shows password page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowPassphrasePage({error: null}))
  })

  it('navs to password page', () => {
    const {nextState} = init
    expect(_testing.showPassphrasePage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['passphrase'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit', () => {
    const {response, nextState} = init
    const passphrase = new HiddenString('a passphrase')
    const submitAction = ProvisionGen.createSubmitPassphrase({passphrase})
    const submitState = makeNextState(nextState, submitAction)

    _testing.submitPassphraseOrPaperkey(submitState, submitAction)
    expect(response.result).toHaveBeenCalledWith({passphrase: passphrase.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitPassphraseOrPaperkey(submitState, submitAction)).toThrow()
  })
})

describe('passphrase error path', () => {
  const error = new HiddenString('invalid passphrase')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: error.stringValue(),
          type: RPCTypes.passphraseCommonPassphraseType.passPhrase,
        },
      },
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.error).toEqual(error)
  })

  it('shows password page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowPassphrasePage({error}))
  })

  it("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showPassphrasePage(nextState)).toBeFalsy()
  })

  it('submit clears error and submits', () => {
    const {response, nextState} = init
    const passphrase = new HiddenString('a passphrase')
    const submitAction = ProvisionGen.createSubmitPassphrase({passphrase})
    const submitState = makeNextState(nextState, submitAction)
    expect(submitState.provision.error).toEqual(noError)

    _testing.submitPassphraseOrPaperkey(submitState, submitAction)
    expect(response.result).toHaveBeenCalledWith({passphrase: passphrase.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitPassphraseOrPaperkey(submitState, submitAction)).toThrow()
  })
})

describe('paperkey happy path', () => {
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: null,
          type: RPCTypes.passphraseCommonPassphraseType.paperKey,
        },
      },
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.error).toEqual(noError)
  })

  it('shows paperkey page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowPaperkeyPage({error: null}))
  })

  it('navs to paperkey page', () => {
    const {nextState} = init
    expect(_testing.showPaperkeyPage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['paperkey'], [Tabs.loginTab, 'login']))
    )
  })

  it('submit', () => {
    const {response, nextState} = init
    const paperkey = new HiddenString('one two three four five six seven eight')
    const submitAction = ProvisionGen.createSubmitPaperkey({paperkey})
    const submitState = makeNextState(nextState, submitAction)

    _testing.submitPassphraseOrPaperkey(submitState, submitAction)
    expect(response.result).toHaveBeenCalledWith({passphrase: paperkey.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitPassphraseOrPaperkey(submitState, submitAction)).toThrow()
  })
})

describe('paperkey error path', () => {
  const error = new HiddenString('invalid paperkey')
  let init
  beforeEach(() => {
    init = makeInit({
      method: 'keybase.1.secretUi.getPassphrase',
      payload: {
        pinentry: {
          retryLabel: error.stringValue(),
          type: RPCTypes.passphraseCommonPassphraseType.paperKey,
        },
      },
    })
  })

  it('init', () => {
    const {nextState} = init
    expect(nextState.provision.error).toEqual(error)
  })

  it('shows paperkey page', () => {
    const {action} = init
    expect(action).toEqual(ProvisionGen.createShowPaperkeyPage({error}))
  })

  it("doesn't nav away", () => {
    const {nextState} = init
    expect(_testing.showPaperkeyPage(nextState)).toBeFalsy()
  })

  it('submit clears error and submits', () => {
    const {response, nextState} = init
    const paperkey = new HiddenString('eight seven six five four three two one')
    const submitAction = ProvisionGen.createSubmitPaperkey({paperkey})
    const submitState = makeNextState(nextState, submitAction)
    expect(submitState.provision.error).toEqual(noError)

    _testing.submitPassphraseOrPaperkey(submitState, submitAction)
    expect(response.result).toHaveBeenCalledWith({passphrase: paperkey.stringValue(), storeSecret: false})
    expect(response.error).not.toHaveBeenCalled()

    // only submit once
    expect(() => _testing.submitPassphraseOrPaperkey(submitState, submitAction)).toThrow()
  })
})

describe('canceling provision', () => {
  it('ignores other paths', () => {
    const manager = _testing.makeProvisioningManager(false)
    const state: any = {
      routeTree: {
        routeState: {
          selected: Tabs.chatTab,
        },
      },
    }
    const response = {error: jest.fn(), result: jest.fn()}

    // start the process so we get something stashed
    manager._stashResponse('keybase.1.gpgUi.selectKey', response)

    _testing.maybeCancelProvision(state)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).not.toHaveBeenCalled()
    expect(manager._stashedResponse).not.toEqual(null)
    expect(manager._stashedResponseKey).not.toEqual(null)
  })

  it('cancels', () => {
    const manager = _testing.makeProvisioningManager(false)
    const state: any = {
      routeTree: {
        routeState: {
          selected: Tabs.loginTab,
        },
      },
    }
    const response = {error: jest.fn(), result: jest.fn()}

    // start the process so we get something stashed
    manager._stashResponse('keybase.1.gpgUi.selectKey', response)

    _testing.maybeCancelProvision(state)
    expect(response.result).not.toHaveBeenCalled()
    expect(response.error).toHaveBeenCalledWith({
      code: RPCTypes.constantsStatusCode.scgeneric,
      desc: 'Canceling RPC',
    })
    expect(manager._stashedResponse).toEqual(null)
    expect(manager._stashedResponseKey).toEqual(null)
  })
})

describe('final errors show', () => {
  it('shows the final error page', () => {
    const error = new RPCError('something bad happened', 1, [])
    const action = ProvisionGen.createShowFinalErrorPage({finalError: error})
    const state = provStateToTypedState(Constants.makeState())
    const nextState = makeNextState(state, action)

    expect(nextState.provision.finalError).toBeTruthy()

    expect(_testing.showFinalErrorPage(nextState)).toEqual(
      Saga.put(RouteTree.navigateAppend(['error'], [Tabs.loginTab, 'login']))
    )
  })
})

describe('manager', () => {
  it('complains about invalid response key', () => {
    const manager = _testing.makeProvisioningManager(false)
    const stashed = () => {
      console.log('whu')
    }
    manager._stashResponse('keybase.1.gpgUi.selectKey', stashed)
    expect(() => manager._getAndClearResponse('keybase.1.loginUi.getEmailOrUsername')).toThrow()
  })
  it('complains about no response key', () => {
    const manager = _testing.makeProvisioningManager(false)
    expect(() => manager._getAndClearResponse('keybase.1.loginUi.getEmailOrUsername')).toThrow()
  })
  it('stashing works', () => {
    const manager = _testing.makeProvisioningManager(false)
    const stashed = () => {
      console.log('whu')
    }
    manager._stashResponse('keybase.1.gpgUi.selectKey', stashed)
    expect(manager._getAndClearResponse('keybase.1.gpgUi.selectKey')).toEqual(stashed)
  })
})