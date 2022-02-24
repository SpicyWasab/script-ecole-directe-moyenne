# script-ecole-directe-moyenne
**This is part of my [script](https://github.com/SpicyWasab/scripts) project**  
A Node.js script to get the overall average, fetching all marks from EcoleDirecte  
This uses node-fetch, ora, and prompt-promise as dependencies.

sidenote : with node v17.5, the script can be used without node-fetch, but only through the `--experimental-fetch` node flag.  
This allows removing the custom user-agent, because EcoleDirecte seems to have banned the `"node-fetch"` user-agent. In future node versions, this could be usable without the flag.
