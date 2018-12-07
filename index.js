
const DefaultColor = 1
const UseJobSpecificMarkers = true

/*
colors: 0 = red, 1 = yellow, 2 = blue

jobs: warrior = 0, lancer = 1, slayer = 2, berserker = 3,
sorcerer = 4, archer = 5, priest = 6, mystic = 7,
reaper = 8, gunner = 9, brawler = 10, ninja = 11,
valkyrie = 12
*/

const JobSpecificMarkers = [
	{
		jobs: [1, 10],
		color: 0
	},
	{
		jobs: [6, 7],
		color: 2
	},
]

module.exports = function PartyDeathMarkers (dispatch) {

	const command = dispatch.command || dispatch.require.command
	let delay = 500
	let enabled = true
	let toparty = false
	let isLeader = false
	let myID = null
	let timer = null
	let Markers = []
	let deadPeople = []
	let partyMembers = []
	
	const UpdateMarkers = () => {
		if(enabled)
		{
			if(toparty && isLeader)
			{
				dispatch.toServer('C_PARTY_MARKER', 1, {
					markers: Markers
				})
			}
			else
			{
				dispatch.toClient('S_PARTY_MARKER', 1, {
					markers: Markers
				})
			}
		}
	}
	
	const clearMarkerById = (id) => {
		const wasdead = deadPeople.indexOf(id)
		if (wasdead === -1) return;
		//console.log(`dead pos clearing # ${wasdead} for ${String(deadPeople[wasdead])}`)
		deadPeople.splice(wasdead, 1)
		const mpos = Markers.findIndex((mar) => mar.target === id)
		//console.log(`delete array marker at # ${mpos}`)
		if(mpos !== -1)
		{
			//console.log(`delete array marker for ${String(Markers[mpos].target)}`)
			//console.log(`d number of marks ${Markers.length}; number of dead ${deadPeople.length}`)
			Markers.splice(mpos, 1)
			clearTimeout(timer)
			timer = setTimeout(UpdateMarkers, delay)
			//console.log("DEBUG remove: marker array:")
			//console.log(Markers)
			//console.log("DEBUG remove: dead array:")
			//console.log(deadPeople)
		}
		else
		{
			console.log("weird stuff, can't find marker for the dead: marker array:")
			console.log(Markers)
			console.log("weird stuff, can't find marker for the dead: party array:")
			console.log(partyMembers)
		}
	}

	const getMarkColor = (jobId) => {
		if (UseJobSpecificMarkers) {
			for (const markers of JobSpecificMarkers) {
				if (markers.jobs.includes(jobId)) {
					return markers.color
				}
			}
		}
		return DefaultColor
	}
	
	command.add('markers', () => {
		enabled = !enabled
		command.message(enabled ? 'Death Markers enabled' : 'Death Markers disabled')
	})
	
	command.add('markers.toparty', () => {
		toparty = !toparty
		command.message(toparty ? 'Death Markers will be visible to all party members (requires leadership)' : 'Only you will be able to see Death Markers')
	})
	
	/*command.add('delay', (arg) => {
		if(arg)
		{
			delay = parseInt(arg, 10)
			command.message('setting delay to ' + delay)
			//console.log('setting delay to ' + delay)
		}
	})
	
	command.add('upd', () => {
		UpdateMarkers()
		command.message('Update Markers ')
		//console.log('Update Markers ')
	})*/
	
	const checkLeader = (Id) => {
		if(myID === Id)
		{
			isLeader = true
			if(toparty && enabled)
			{
				command.message('You are the Leader of the party, death Markers will be visible to all party members now')
			}
		}
	}
	
	dispatch.hook('S_LOGIN', 10, ({playerId}) => {	
		partyMembers.length = 0
		deadPeople.length = 0
		Markers.length = 0
		isLeader = false
		myID = playerId
    })
	
	dispatch.hook('S_CHANGE_PARTY_MANAGER', 2, ({playerId}) => {
        checkLeader(playerId)
    })
	
	dispatch.hook('S_PARTY_MEMBER_LIST', 7, ({members, leaderPlayerId}) => {
		checkLeader(leaderPlayerId)
		partyMembers = members
		//console.log(`in party with ${partyMembers.length}`)
	})

	dispatch.hook('S_CREATURE_LIFE', 3, ({gameId, alive}) => {
		if(alive)
		{
			//console.log(`someone revived ${String(gameId)}`)
			clearMarkerById(gameId)
		}
		else
		{
			//console.log(`someone died ${String(gameId)}`)
			const member = partyMembers.find((memb) => memb.gameId === gameId)
			if (!member) return;
			if (deadPeople.indexOf(gameId) === -1)
			{
				Markers.push({color: getMarkColor(member.class), target: gameId})
				deadPeople.push(gameId)
				//console.log(`new mark for ${member.name}, id: ${String(gameId)}`)
				//console.log(`number of marks ${Markers.length}, number of dead ${deadPeople.length}`)
				//console.log("DEBUG: marker array:")
				//console.log(Markers)
				//console.log("DEBUG: dead array:")
				//console.log(deadPeople)
				clearTimeout(timer)
				setTimeout(UpdateMarkers, delay)
			}
		}
	})

	dispatch.hook('S_LEAVE_PARTY_MEMBER', 2, ({playerId}) => {
		//console.log(`in party with ${partyMembers.length} people, someone left`)
		const member = partyMembers.find((memb) => memb.playerId === playerId)
		if (!member) return;
		//console.log("S_LEAVE_PARTY_MEMBER " + String(member.gameId))
		clearMarkerById(member.gameId)
		partyMembers = partyMembers.filter((memb) => memb.playerId === playerId)
	})

	dispatch.hook('S_LEAVE_PARTY', 'raw', () => {
		partyMembers.length = 0
		deadPeople.length = 0
		Markers.length = 0
		isLeader = false
		UpdateMarkers()
	})
}
