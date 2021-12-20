import express, { Application, Request, Response } from "express";
import _ from "lodash"; 
import axios from 'axios';
var cors = require('cors');

const app: Application = express();
const port = 3000;
const url = "/matches"


var corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}


async function getTournamentsDataAsync(){
    const res = await axios
        .get('https://cp.fn.sportradar.com/common/en/Etc:UTC/gismo/config_tournaments/1/17');
    return res.data.doc[0].data;
}

function getMatchesDataAsync(tid: number){
    return axios
        .get(`https://cp.fn.sportradar.com/common/en/Etc:UTC/gismo/fixtures_tournament/${tid}/2021`)
        .then((res: any) => {
            const matches = res.data.doc[0].data.matches;

            return Object.keys(matches).map(x => {
                const match = matches[x];
                return convertToMatch(match, tid);
            });            
        });
}

interface IMatch {
    tournamentId: number;
    dateTime: Date;
    teams: ITeams;
    score: IScore;
    events: string;
}

interface ITeams {
    home: string;
    away: string;
}

interface IScore {
    home: number;
    away: number;
}

interface ITournament {
    id: number;
    name: string;
}

interface IStatistics{
    tournament: ITournament,
    matches: IMatch[]
}

function convertToMatch(obj: any, tid: number) : IMatch {    
    var dateParts = obj.time.date.split("/").reverse();
    const dateTimeString = `20${dateParts[0]}-${dateParts[1]}-${dateParts[2]}T${obj.time.time}`;
    //console.log(dateTimeString);
    return {
        tournamentId: tid,
        dateTime: new Date(dateTimeString),
        teams: {
            home: obj.teams.home.name,
            away: obj.teams.away.name
        },
        score: {
            home: obj.result.home,
            away: obj.result.away
        },
        events: obj.comment
    };
}

function convertToTournament(obj: any): ITournament{
    return {
        id: obj._id,
        name: obj.name
    };
}
function convertToStatistics(tournament: ITournament, matches: IMatch[]): IStatistics{
    return {
        tournament: tournament,
        matches: matches
    };
}

function populate(matches: any, tournament: any, allMatches: Array<IMatch>, allTournamentsNormalised: Array<ITournament>){
    allMatches.push(...matches);
    const itournament = convertToTournament(tournament);
    allTournamentsNormalised.push(itournament)
}

app.get(
    url,
    cors(corsOptions),
    async (req: Request, res: Response): Promise<Response> => {
        const allTournaments = await getTournamentsDataAsync();
        const tournaments = allTournaments.tournaments;
        const uniquetournaments = allTournaments.uniquetournaments;

        const allMatches = new Array<IMatch>();
        const allTournamentsNormalised = new Array<ITournament>();
        
        for (const tournament of tournaments) {
            const matches = await getMatchesDataAsync(tournament._id);
            populate(matches, tournament, allMatches, allTournamentsNormalised)
        }
        for (const uniquetournamentId of Object.keys(uniquetournaments)) {
            const uniquetournament = uniquetournaments[uniquetournamentId];
            const matches = await getMatchesDataAsync(uniquetournament._id);
            if(matches.length == 0) break;
            populate(matches, uniquetournament, allMatches, allTournamentsNormalised)
        }

        const ordered = _.orderBy(allMatches, x => x.dateTime, "desc");
        const limited = _.take(ordered, 5);
        const grouped = _.groupBy(limited, x => x.tournamentId);

        const statistics = new Array<IStatistics>();

        for (const id of Object.keys(grouped)) {
            const tournament = allTournamentsNormalised.find(e => e.id == parseInt(id) ? e:null);
            if(tournament){
            statistics.push(convertToStatistics(tournament, grouped[id]));
        }
    }
        return res.status(200).send({
           statistics
        });
    }
);

app.get(
    "/test",
    cors(corsOptions),
    async (req: Request, res: Response): Promise<Response> => {
        console.log('TEST');
        const matches = await getMatchesDataAsync(1);
        return res.status(200).send({
            matches
        });
    }
);

try {
    app.listen(port, (): void => {
        console.log(`Connected successfully on port ${port}`);
    });
} catch (error:any) {
    console.error(`Error occured: ${error.message}`);
}

console.log('--------------------------------------------------------------------------------------------------------------------------');