import {strict as assert} from 'node:assert';
import {createStore} from '../../src/store/index.js';

describe('store', () => {
  /** @type {ReturnType<typeof createStore>} */
  let store;

  beforeEach(() => {
    store = createStore();
  });

  describe('credentials', () => {
    it('should store and retrieve a credential', () => {
      const vc = {id: 'cred-1', type: ['VerifiableCredential']};
      store.credentials.set('cred-1', {
        vc, mandatoryPointers: [], deleted: false
      });
      const entry = store.credentials.get('cred-1');
      assert.deepEqual(entry?.vc, vc);
    });

    it('should soft delete a credential', () => {
      const vc = {id: 'cred-1', type: ['VerifiableCredential']};
      store.credentials.set('cred-1', {
        vc, mandatoryPointers: [], deleted: false
      });
      const entry = store.credentials.get('cred-1');
      if(entry) {
        entry.deleted = true;
      }
      assert.equal(store.credentials.get('cred-1')?.deleted, true);
    });
  });

  describe('challenges', () => {
    it('should store and retrieve a challenge', () => {
      const expires = Date.now() + 60000;
      store.challenges.set('nonce-abc', {expires});
      assert.equal(store.challenges.get('nonce-abc')?.expires, expires);
    });

    it('should allow deleting a used challenge', () => {
      store.challenges.set('nonce-abc', {expires: Date.now() + 60000});
      store.challenges.delete('nonce-abc');
      assert.equal(store.challenges.get('nonce-abc'), undefined);
    });
  });

  describe('isolation', () => {
    it('should create independent stores', () => {
      const store1 = createStore();
      const store2 = createStore();
      store1.credentials.set('cred-1', {
        vc: {id: 'cred-1', type: 'VerifiableCredential'},
        mandatoryPointers: [],
        deleted: false
      });
      assert.equal(store2.credentials.get('cred-1'), undefined);
    });
  });
});
