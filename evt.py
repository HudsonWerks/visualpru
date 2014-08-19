import gevent
from gevent import queue, sleep
from geventwebsocket.websocket import WebSocketError
import json

queue = gevent.queue.Queue()


#For now, we will poll PRU registers for register changes
#When the PRU interrupt controller interface is implemented, when we will monitor for a host interrupt.
def monitor_prus(prus):
    global queue
    previous_status = {}
    current_status = {}
    while True:
        #print("Monitoring PRUs...")
        #Manually detect when the PRU state has changed independent of a user request and update the front-end state.
        #This is needed when a program changes state from 'running' to 'stopped' so we can update the registers on the front-end
        for k,v in prus.iteritems():
            previous_status[k] = current_status.get(k,None)
            current_status[k] = v.get_status()
            if current_status.get(k,None) == 'halted' and previous_status.get(k,None) == 'running':
                print("PROGRAM HAS STOPPED!")
                response = {}
                response['type'] = 'pruState'
                response['pruState'] = v.get_state()

                queue.put(response)

        #We need a sleep call so that other greenlets can run
        gevent.sleep()

def send_message(socket):
    global queue
    while True:
        try:
            if not queue.empty():
                #print("QUEUE NOT EMPTY")
                message = queue.get(block=False)
                if not socket.closed:
                    socket.send(json.dumps(message))
                    #print('Sent response')

            #We need a sleep call so that other greenlets can run
            gevent.sleep()
        except Exception as e:
            print("SEND: %s" % e)
            raise e