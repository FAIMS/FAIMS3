import React from 'react';
import {Grid,CardActionArea,CardActions,CardContent,Typography,Card,Button} from '@material-ui/core';
import BookmarkIcon from '@material-ui/icons/Bookmark';
import BeenhereIcon from '@material-ui/icons/Beenhere';
import { makeStyles } from '@material-ui/core/styles';

const initialValues = {
	title:'',
}
const useStyles = makeStyles((theme) => ({
	content: {
    minHeight: 100,
    minWidth: 280,
    [theme.breakpoints.down('sm')]:{
      width:'100%',
    }
    },
    inputfieldscard: {
    backgroundColor:'#353b40',
    color:'#fff',
    textAlign:'right',
    [theme.breakpoints.down('sm')]:{
      marginBottom:15,
      marginTop:10,
    }
    },

}));
export const fields=
	[{name:'Text',des:'text plus sepcial characters',id:'TextField',icon:<BookmarkIcon />},
	{name:'Text',des:'text plus sepcial characters',id:'TextField',icon:<BeenhereIcon />}
	]

	

function FieldCard(props:any){
	const  { className,handelonClick,fields, ...other } = props;
	return (
	<Grid container spacing={2}  >
		{fields.map((field:any,index:any)=>(
			<Grid item key={`${field.name}-${index}`} id={`${field.name}-${index}`} className={className}>
				<Card>
					< CardActionArea onClick={() => handelonClick(field.id)}>
				        <CardContent  >
				        	<Grid container spacing={2} key={`${field.name}-card-${index}`}>
                    			<Grid item sm={2} xs={12}>
				        		{field.icon}
				        		</Grid>
				        		<Grid item sm={10} xs={12} >
						        <Typography variant="body2" component="p">
						         {field.name}
						          <br />
						          {field.des}
						        </Typography>
					        	</Grid>
					        </Grid>
					    </CardContent>
					      
				    </ CardActionArea>
				</Card>
			</Grid>       
		))} 
	</Grid>
	);
}

export default function FieldsListCard(props: any) {
	const classes = useStyles();
	return (
		<>
		
					<FieldCard className={classes.content} handelonClick={props.cretenefield}  fields={fields}/> 
				
		</>
    )
}


