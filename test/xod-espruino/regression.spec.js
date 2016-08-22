
import thunk from 'redux-thunk';
import { createStore, applyMiddleware } from 'redux';
import { default as chai, expect } from 'chai';
import dirtyChai from 'dirty-chai';

import Selectors from '../../src/client/app-browser/selectors';
import runtime from '!raw!../../src/runtime/xod-espruino/runtime';
import transpile from '../../src/runtime/xod-espruino/transpiler';
import initialState from '../../src/client/app-browser/state';
import generateReducers from '../../src/client/app-browser/reducer';
import { addNode } from '../../src/client/project/actions';

chai.use(dirtyChai);

describe('xod-espruino', () => {
  it('should transpile example initial state to kinda valid code', () => {
    const store = createStore(generateReducers([1]), initialState, applyMiddleware(thunk));
    store.dispatch(addNode('core/button', { x: 100, y: 100 }, 1));

    const projectJSON = Selectors.Project.getProjectJSON(store.getState());
    const project = JSON.parse(projectJSON);
    const code = transpile({ project, runtime });

    // We test the code generated by fare evaluation. Yes, this
    // will inject variables to the scope, so we limit it with an
    // anonimous function.
    /* eslint-disable no-undef */
    (() => {
      const mod = eval.call(null, code); // eslint-disable-line
      expect(project).to.exist();
      expect(nodes).to.exist();
      expect(topology).to.exist();
      expect(onInit).to.exist();

      expect(nodes).to.have.keys('1');
      expect(topology).to.be.eql([1]);
    })();
    /* eslint-enable no-undef */
  });
});
