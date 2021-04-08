import tracking from './tracking';
import context from './test/utils/handler-helper';
import event from './test/fixtures/event.json';

const callback = jest.fn();

describe('tracking', () => {
  it('executes as expected', async () => {
    const response = await tracking(event, context, callback);
    expect(response).toMatchSnapshot();
  });
});
