import React from 'react';
import { Button, Form, Container, Row, Col } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import kuzzle from './kuzzle';

const Message = ({ message, username }) => {
  const isSender = message.username === username;

  return (
    <div className={`message-container ${isSender ? 'sender-message' : 'receiver-message'}`}>
      <span className="font-weight-bold">{message.username}</span>
      <span className="ml-2 text-muted timestamp">
        ({new Date(message._kuzzle_info.createdAt).toLocaleDateString()})
      </span>
      <p className="message-text">{message.value}</p>
    </div>
  );
};

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      username: '',
      message: '',
      messages: [],
      connected: false,
    };
  }

  connect = async () => {
    await kuzzle.connect();
    if (!(await kuzzle.index.exists('chat'))) {
      await kuzzle.index.create('chat');
      await kuzzle.collection.create('chat', 'messages');
    }
    await this.fetchMessages();
    await this.subscribeMessages();
    this.setState({ connected: true });
  };

  fetchMessages = async () => {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
    const results = await kuzzle.document.search(
      'chat',
      'messages',
      {
        sort: { '_kuzzle_info.createdAt': 'desc' },
        query: {
          range: {
            '_kuzzle_info.createdAt': {
              gte: twentyFourHoursAgo.toISOString(),
            },
          },
        },
      }
    );
  
    this.setState({ messages: results.hits });
  };
  

  subscribeMessages = () => {
    return kuzzle.realtime.subscribe(
      'chat',
      'messages',
      {},
      (notification) => {
        this.setState({
          messages: [notification.result, ...this.state.messages],
        });
      }
    );
  };

  sendMessage = async () => {
    if (this.state.message === '') return;
    await kuzzle.document.create('chat', 'messages', {
      value: this.state.message,
      username: this.state.username,
    });
    this.setState({ message: '' });
  };

  renderConnectionForm = () => {
    return (
      <Container>
        <Row className="mt-5">
          <Col md={{ span: 4, offset: 4 }}>
            <Form>
              <Form.Group controlId="formUsername">
                <Form.Control
                  type="text"
                  name="username"
                  placeholder="Enter your name"
                  onChange={this.handleInputChange}
                />
              </Form.Group>
              <Button variant="primary" onClick={this.connect}>
                Connect
              </Button>
            </Form>
          </Col>
        </Row>
      </Container>
    );
  };

  renderMessageForm = () => {
    return (
      <div className="message-form-container">
        <div>
          <input
            type="text"
            name="message"
            placeholder="Enter your message"
            onChange={this.handleInputChange}
            value={this.state.message}
          />
          <Button onClick={() => this.sendMessage()}>Send</Button>
        </div>
        <Button variant="danger" onClick={this.clearChatHistory}>
          Clear
        </Button>
      </div>
    );
  };
   

  handleInputChange = (event) => {
    const { value, name } = event.target;
    this.setState({
      [name]: value,
    });
  };

  render() {
    return (
      <div>
        {this.state.connected ? (
          <div>
            <div className="message-container">
              {this.state.messages.map((message) => (
                <Message
                  key={message._id}
                  message={message._source}
                  username={this.state.username}
                />
              ))}
            </div>
            <div className="message-form-container">
              {this.renderMessageForm()}
            </div>
          </div>
        ) : (
          this.renderConnectionForm()
        )}
      </div>
    );
  }
  
  

  clearChatHistory = async () => {
    if (!this.state.connected) {
      return;
    }
  
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
  
    await kuzzle.document.deleteByQuery(
      'chat',
      'messages',
      {
        query: {
          range: {
            '_kuzzle_info.createdAt': {
              lt: twentyFourHoursAgo.toISOString(),
            },
          },
        },
      }
    );
  
    this.setState((prevState) => {
      return {
        messages: (prevState.messages || []).filter(
          (message) =>
            message._kuzzle_info &&
            new Date(message._kuzzle_info.createdAt) > twentyFourHoursAgo
        ),
      };
    });

  console.log('Chat history cleared forever!');
  };
  
}

export default App;
