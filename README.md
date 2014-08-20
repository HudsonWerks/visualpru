VisualPRU
=========

VisualPRU is a minimal browser-based editor and debugger for the Beaglebone PRUs. The app runs from a local server on the Beaglebone and is accessed by connecting your Beaglebone to the local network(via a USB connection, ethernet, or wireless) and navigating your browser to **192.168.7.2:3333**.

The hardware is accessed by twiddling bits in memory-mapped /dev/mem . Assembly programs are compiled using TI's open-source pasm library.

Installation
----

```sh
pip install bottle
pip install gevent
pip install gevent-websocket

cd /home
git clone https://github.com/mmcdan/visualpru.git
```
Finally, run *linuxbuild* script in [pasm] and put the resulting executable in /usr/local/bin (or another system-wide binary location)

Running
----
Just go into the VisualPRU directory and type **python visualpru.py**, then navigate to **192.168.7.2:3333** with your browser! To stop the program, use **CTRL-C**.

TODO
----
* Add the ability to load existing source files
* Highlight errors in the editor view
* Allow the user to modify memory registers
* Show Data RAM, Scratchpad RAM, and DDR RAM chunk in memory view
* Add better error-handling for edge cases
* Add unit tests

Known Issues
----
* Web interface layout is compressed when using Internet Explorer

License
----

MIT

[pasm]:https://github.com/beagleboard/am335x_pru_package/tree/master/pru_sw/utils/pasm_source